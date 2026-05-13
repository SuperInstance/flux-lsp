/**
 * diagnostics.ts — Diagnostic provider for .fluxasm files
 *
 * Validates parsed documents and produces LSP diagnostics for:
 * - Unknown opcodes
 * - Invalid register format / index out of range
 * - Wrong operand count for instruction format
 * - Duplicate label definitions
 * - Missing HALT / termination instruction
 * - Unresolved label references
 * - Invalid directives
 * - Section placement issues
 */

import {
  Diagnostic,
  DiagnosticSeverity,
  Range,
} from "vscode-languageserver-protocol";
import { ParseResult, InstructionNode, LabelDefNode, DirectiveNode, TokenType } from "./parser";
import { opcodeByName, registerByName } from "./opcode_db";

// ---------------------------------------------------------------------------
// Diagnostic codes
// ---------------------------------------------------------------------------

export const DiagnosticCode = {
  UNKNOWN_OPCODE:        "flux-001",
  INVALID_REGISTER:      "flux-002",
  WRONG_OPERAND_COUNT:   "flux-003",
  DUPLICATE_LABEL:       "flux-004",
  UNRESOLVED_LABEL:      "flux-005",
  MISSING_HALT:          "flux-006",
  INVALID_DIRECTIVE:     "flux-007",
  INVALID_IMMEDIATE:     "flux-008",
  WRONG_OPERAND_TYPE:    "flux-009",
  OPERAND_OUT_OF_RANGE:  "flux-010",
  SECTION_AFTER_CODE:    "flux-011",
} as const;

// ---------------------------------------------------------------------------
// Helper to build ranges
// ---------------------------------------------------------------------------

function tokenRange(line: number, col: number, length: number): Range {
  return {
    start: { line, character: col },
    end:   { line, character: col + length },
  };
}

// ---------------------------------------------------------------------------
// Main diagnostic computation
// ---------------------------------------------------------------------------

export function computeDiagnostics(result: ParseResult): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Track first occurrence of labels to detect duplicates
  const seenLabels = new Map<string, { node: LabelDefNode; first: boolean }>();

  // First pass: collect label definitions
  for (const node of result.nodes) {
    if (node.kind === "label") {
      const upper = node.name.text.toUpperCase();
      if (seenLabels.has(upper)) {
        seenLabels.get(upper)!.first = false;
      } else {
        seenLabels.set(upper, { node, first: true });
      }
    }
  }

  // Check duplicate labels
  for (const [, entry] of seenLabels) {
    if (!entry.first) {
      // We'll catch all duplicates in the second pass
    }
  }

  const firstLabelOccurrence = new Map<string, LabelDefNode>();

  // Second pass: validate all nodes
  for (const node of result.nodes) {
    switch (node.kind) {
      case "instruction":
        validateInstruction(node, diagnostics);
        break;
      case "label":
        validateLabel(node, firstLabelOccurrence, diagnostics);
        break;
      case "directive":
        validateDirective(node, diagnostics);
        break;
      case "error":
        diagnostics.push({
          range: tokenRange(node.token.line, node.token.col, node.token.length),
          message: node.message,
          severity: DiagnosticSeverity.Error,
          source: "flux-lsp",
          code: DiagnosticCode.UNKNOWN_OPCODE,
        });
        break;
    }
  }

  // Check for unresolved label references
  for (const [refName, refNodes] of result.labelRefs) {
    if (!result.labels.has(refName)) {
      for (const instr of refNodes) {
        for (const op of instr.operands) {
          if (op.text.toUpperCase() === refName) {
            diagnostics.push({
              range: tokenRange(op.line, op.col, op.length),
              message: `Unresolved label reference: '${op.text}'`,
              severity: DiagnosticSeverity.Error,
              source: "flux-lsp",
              code: DiagnosticCode.UNRESOLVED_LABEL,
            });
          }
        }
      }
    }
  }

  // Check for missing HALT
  checkMissingHalt(result, diagnostics);

  return diagnostics;
}

// ---------------------------------------------------------------------------
// Instruction validation
// ---------------------------------------------------------------------------

function validateInstruction(node: InstructionNode, diagnostics: Diagnostic[]): void {
  const mnemonicUpper = node.mnemonic.text.toUpperCase();
  const entry = opcodeByName.get(mnemonicUpper);

  // Unknown opcode
  if (!entry) {
    // Check if it might be a typo — look for similar mnemonics
    const suggestion = findSimilarMnemonic(mnemonicUpper);
    const msg = suggestion
      ? `Unknown opcode: '${node.mnemonic.text}'. Did you mean '${suggestion}'?`
      : `Unknown opcode: '${node.mnemonic.text}'`;

    diagnostics.push({
      range: tokenRange(node.mnemonic.line, node.mnemonic.col, node.mnemonic.length),
      message: msg,
      severity: DiagnosticSeverity.Error,
      source: "flux-lsp",
      code: DiagnosticCode.UNKNOWN_OPCODE,
    });
    return;
  }

  // Validate operand count
  const expectedCount = entry.operands.length;
  const actualCount = node.operands.length;

  if (actualCount !== expectedCount) {
    diagnostics.push({
      range: tokenRange(node.mnemonic.line, node.mnemonic.col, node.mnemonic.length),
      message: `Wrong operand count for '${mnemonicUpper}': expected ${expectedCount} (${entry.operandStr}), got ${actualCount}`,
      severity: DiagnosticSeverity.Error,
      source: "flux-lsp",
      code: DiagnosticCode.WRONG_OPERAND_COUNT,
    });
  }

  // Validate each operand
  for (let i = 0; i < node.operands.length; i++) {
    const op = node.operands[i];
    validateOperand(op, i, entry, diagnostics);
  }
}

function validateOperand(
  op: { text: string; line: number; col: number; length: number; type: TokenType },
  index: number,
  entry: { operands: string[]; name: string; operandStr: string },
  diagnostics: Diagnostic[],
): void {
  const expectedType = index < entry.operands.length ? entry.operands[index] : null;
  const upper = op.text.toUpperCase();

  // Check register validity
  if (expectedType && (expectedType.startsWith("r") || expectedType.startsWith("f") || expectedType.startsWith("v"))) {
    // This should be a register
    if (/^[RFV]\d+$/i.test(upper)) {
      const regInfo = registerByName.get(upper);
      if (!regInfo) {
        // Register index out of range (e.g. R16, F20, V20)
        const match = upper.match(/^([RFV])(\d+)$/);
        const maxIndex = match ? (match[1] === "R" ? 15 : match[1] === "F" ? 15 : 15) : 15;
        diagnostics.push({
          range: tokenRange(op.line, op.col, op.length),
          message: `Invalid register: '${op.text}'. Register index must be 0–${maxIndex}.`,
          severity: DiagnosticSeverity.Error,
          source: "flux-lsp",
          code: DiagnosticCode.INVALID_REGISTER,
        });
        return;
      }

      // Check register type matches expected
      const expectedPrefix = expectedType[0].toUpperCase();
      const actualPrefix = upper[0];
      if (expectedPrefix !== actualPrefix) {
        const expectedKind = expectedPrefix === "R" ? "integer" : expectedPrefix === "F" ? "float" : "SIMD";
        diagnostics.push({
          range: tokenRange(op.line, op.col, op.length),
          message: `Wrong register type: expected ${expectedKind} register (${expectedPrefix}0-${expectedPrefix}15), got '${op.text}'`,
          severity: DiagnosticSeverity.Warning,
          source: "flux-lsp",
          code: DiagnosticCode.WRONG_OPERAND_TYPE,
        });
      }
    } else if (!/^-?\d/.test(op.text) && !/^0x/i.test(op.text)) {
      // Not a register, not an immediate — might be a label or wrong type
      if (expectedType !== "label") {
        diagnostics.push({
          range: tokenRange(op.line, op.col, op.length),
          message: `Expected register for operand ${index + 1} of '${entry.name}', got '${op.text}'`,
          severity: DiagnosticSeverity.Warning,
          source: "flux-lsp",
          code: DiagnosticCode.WRONG_OPERAND_TYPE,
        });
      }
    }
  }

  // Validate immediate values
  if (expectedType === "imm16") {
    if (/^-?\d+$/.test(op.text)) {
      const val = parseInt(op.text, 10);
      if (val < -32768 || val > 65535) {
        diagnostics.push({
          range: tokenRange(op.line, op.col, op.length),
          message: `Immediate value ${val} out of range for 16-bit: -32768 to 65535`,
          severity: DiagnosticSeverity.Warning,
          source: "flux-lsp",
          code: DiagnosticCode.OPERAND_OUT_OF_RANGE,
        });
      }
    } else if (/^0x[0-9A-Fa-f]+$/i.test(op.text)) {
      const val = parseInt(op.text, 16);
      if (val > 0xFFFF) {
        diagnostics.push({
          range: tokenRange(op.line, op.col, op.length),
          message: `Immediate value 0x${val.toString(16).toUpperCase()} out of range for 16-bit`,
          severity: DiagnosticSeverity.Warning,
          source: "flux-lsp",
          code: DiagnosticCode.OPERAND_OUT_OF_RANGE,
        });
      }
    } else if (!/^[A-Za-z_]/.test(op.text)) {
      // Not a number or label — invalid immediate
      diagnostics.push({
        range: tokenRange(op.line, op.col, op.length),
        message: `Invalid immediate value: '${op.text}'`,
        severity: DiagnosticSeverity.Error,
        source: "flux-lsp",
        code: DiagnosticCode.INVALID_IMMEDIATE,
      });
    }
  }

  if (expectedType === "imm8") {
    if (/^-?\d+$/.test(op.text)) {
      const val = parseInt(op.text, 10);
      if (val < -128 || val > 255) {
        diagnostics.push({
          range: tokenRange(op.line, op.col, op.length),
          message: `Immediate value ${val} out of range for 8-bit: -128 to 255`,
          severity: DiagnosticSeverity.Warning,
          source: "flux-lsp",
          code: DiagnosticCode.OPERAND_OUT_OF_RANGE,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Label validation
// ---------------------------------------------------------------------------

function validateLabel(
  node: LabelDefNode,
  firstOccurrence: Map<string, LabelDefNode>,
  diagnostics: Diagnostic[],
): void {
  const upper = node.name.text.toUpperCase();

  if (firstOccurrence.has(upper)) {
    // Duplicate label
    diagnostics.push({
      range: tokenRange(node.name.line, node.name.col, node.name.length),
      message: `Duplicate label definition: '${node.name.text}' (first defined at line ${firstOccurrence.get(upper)!.line + 1})`,
      severity: DiagnosticSeverity.Error,
      source: "flux-lsp",
      code: DiagnosticCode.DUPLICATE_LABEL,
      relatedInformation: [
        {
          location: {
            uri: "", // Will be filled by server
            range: tokenRange(
              firstOccurrence.get(upper)!.name.line,
              firstOccurrence.get(upper)!.name.col,
              firstOccurrence.get(upper)!.name.length,
            ),
          },
          message: "First definition here",
        },
      ],
    });
  } else {
    firstOccurrence.set(upper, node);
  }
}

// ---------------------------------------------------------------------------
// Directive validation
// ---------------------------------------------------------------------------

function validateDirective(node: DirectiveNode, diagnostics: Diagnostic[]): void {
  const dirName = node.directive.text.toLowerCase();
  const knownDirectives = [
    ".byte", ".word", ".dword", ".org", ".text", ".data", ".bss",
    ".align", ".global", ".extern", ".include", ".ascii", ".asciz",
    ".space", ".fill", ".set", ".macro", ".endm",
  ];

  if (!knownDirectives.includes(dirName)) {
    diagnostics.push({
      range: tokenRange(node.directive.line, node.directive.col, node.directive.length),
      message: `Unknown directive: '${node.directive.text}'`,
      severity: DiagnosticSeverity.Error,
      source: "flux-lsp",
      code: DiagnosticCode.INVALID_DIRECTIVE,
    });
  }
}

// ---------------------------------------------------------------------------
// Missing HALT check
// ---------------------------------------------------------------------------

function checkMissingHalt(result: ParseResult, diagnostics: Diagnostic[]): void {
  // Only check .text sections
  if (!result.sections.includes(".text")) return;

  // Check if any instruction is HALT
  let hasHalt = false;
  let lastInstructionLine = 0;

  for (const node of result.nodes) {
    if (node.kind === "instruction") {
      lastInstructionLine = node.line;
      if (node.mnemonic.text.toUpperCase() === "HALT") {
        hasHalt = true;
        break;
      }
      // Also accept HCF as termination
      if (node.mnemonic.text.toUpperCase() === "HCF") {
        hasHalt = true;
        break;
      }
    }
  }

  if (!hasHalt && result.nodes.some(n => n.kind === "instruction")) {
    diagnostics.push({
      range: {
        start: { line: lastInstructionLine, character: 0 },
        end:   { line: lastInstructionLine, character: 80 },
      },
      message: "Missing HALT instruction: program should terminate with HALT",
      severity: DiagnosticSeverity.Warning,
      source: "flux-lsp",
      code: DiagnosticCode.MISSING_HALT,
      tags: [2], // Unnecessary
    });
  }
}

// ---------------------------------------------------------------------------
// Fuzzy mnemonic matching (Levenshtein-based)
// ---------------------------------------------------------------------------

function findSimilarMnemonic(input: string): string | null {
  let bestMatch: string | null = null;
  let bestDist = Infinity;

  for (const name of opcodeByName.keys()) {
    if (Math.abs(name.length - input.length) > 2) continue;
    const dist = levenshtein(input, name);
    if (dist < bestDist && dist <= 2) {
      bestDist = dist;
      bestMatch = name;
    }
  }

  return bestMatch;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[m][n];
}
