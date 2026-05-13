/**
 * hover.ts — Hover provider for .fluxasm files
 *
 * Provides rich hover information for:
 * - Opcode mnemonics: description, encoding format, hex code, operand types, flags
 * - Register names: type, width, index, description
 * - Directives: description, syntax, detailed documentation
 * - Labels: definition info, reference count
 */

import {
  Hover,
  MarkupContent,
  MarkupKind,
  Range,
} from "vscode-languageserver-protocol";
import { ParseResult, Token, TokenType, getTokenAtPosition } from "./parser";
import {
  opcodeByName,
  registerByName,
  directiveByName,
  OpcodeEntry,
  RegisterInfo,
  DirectiveInfo,
  CATEGORY_LABELS,
  FlagsAffected,
} from "./opcode_db";

// ---------------------------------------------------------------------------
// Main hover resolution
// ---------------------------------------------------------------------------

export function getHover(result: ParseResult, line: number, character: number): Hover | null {
  const token = getTokenAtPosition(result.tokens, line, character);
  if (!token) return null;

  switch (token.type) {
    case TokenType.Mnemonic:
      return hoverOpcode(token);
    case TokenType.Register:
      return hoverRegister(token);
    case TokenType.Directive:
      return hoverDirective(token);
    case TokenType.LabelRef:
    case TokenType.LabelDef:
      return hoverLabel(token, result);
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Opcode hover
// ---------------------------------------------------------------------------

function hoverOpcode(token: Token): Hover | null {
  const entry = opcodeByName.get(token.text.toUpperCase());
  if (!entry) return null;

  const md = buildOpcodeMarkdown(entry);
  const range: Range = {
    start: { line: token.line, character: token.col },
    end:   { line: token.line, character: token.col + token.length },
  };

  return {
    contents: { kind: MarkupKind.Markdown, value: md },
    range,
  };
}

function buildOpcodeMarkdown(entry: OpcodeEntry): string {
  const lines: string[] = [];

  // Header
  lines.push(`## ${entry.name}`);
  lines.push("");

  // Category badge
  const catLabel = CATEGORY_LABELS[entry.category] ?? entry.category;
  lines.push(`**${catLabel}** — \`${entry.hex}\``);
  lines.push("");

  // Description
  lines.push(entry.description);
  lines.push("");

  // Encoding
  lines.push("### Encoding");
  lines.push("");
  lines.push(`| Property | Value |`);
  lines.push(`|----------|-------|`);
  lines.push(`| Format   | **${entry.format}** |`);
  lines.push(`| Size     | ${entry.size > 0 ? entry.size + " bytes" : "Variable"} |`);
  lines.push(`| Opcode   | \`${entry.hex}\` |`);
  lines.push("");

  // Operands
  if (entry.operands.length > 0) {
    lines.push("### Operands");
    lines.push("");
    lines.push("```");
    lines.push(`${entry.name} ${entry.operandStr}`);
    lines.push("```");
    lines.push("");

    // Operand table
    lines.push("| # | Type | Description |");
    lines.push("|---|------|-------------|");
    for (let i = 0; i < entry.operands.length; i++) {
      const opType = entry.operands[i];
      lines.push(`| ${i + 1} | \`${opType}\` | ${operandDescription(opType)} |`);
    }
    lines.push("");
  }

  // Flags affected
  if (entry.flags) {
    lines.push("### Flags Affected");
    lines.push("");
    const flagList: string[] = [];
    if (entry.flags.zero)      flagList.push("**Z**ero");
    if (entry.flags.negative)  flagList.push("**N**egative");
    if (entry.flags.carry)     flagList.push("**C**arry");
    if (entry.flags.overflow)  flagList.push("**O**verflow");
    if (entry.flags.confidence) flagList.push("**Conf**idence");
    lines.push(flagList.join(", "));
    lines.push("");
  }

  // Detailed description
  lines.push("### Detail");
  lines.push("");
  lines.push(entry.detail);

  return lines.join("\n");
}

function operandDescription(opType: string): string {
  const descriptions: Record<string, string> = {
    rd: "Integer destination register (R0–R15)",
    rs: "Integer source register (R0–R15)",
    rt: "Integer third register (R0–R15)",
    fd: "Float destination register (F0–F15)",
    fs: "Float source register (F0–F15)",
    ft: "Float third register (F0–F15)",
    vd: "SIMD destination register (V0–V15)",
    vs: "SIMD source register (V0–V15)",
    vt: "SIMD third register (V0–V15)",
    imm8: "8-bit immediate value",
    imm16: "16-bit immediate value / address",
    imm32: "32-bit immediate value",
    label: "Label reference (jump/call target)",
    addr: "Memory address",
    none: "No operand",
  };
  return descriptions[opType] ?? opType;
}

// ---------------------------------------------------------------------------
// Register hover
// ---------------------------------------------------------------------------

function hoverRegister(token: Token): Hover | null {
  const info = registerByName.get(token.text.toUpperCase());
  if (!info) {
    // Could be out-of-range register, provide partial info
    const match = token.text.toUpperCase().match(/^([RFV])(\d+)$/);
    if (match) {
      const typeMap: Record<string, string> = { R: "integer", F: "float", V: "SIMD" };
      const maxMap: Record<string, number> = { R: 15, F: 15, V: 15 };
      const prefix = match[1];
      const idx = parseInt(match[2], 10);
      const maxIdx = maxMap[prefix] ?? 15;

      const md = [
        `## ${token.text}`,
        "",
        `**Invalid Register**`,
        "",
        `${typeMap[prefix]} register index out of range: ${idx} (valid: 0–${maxIdx})`,
      ].join("\n");

      const range: Range = {
        start: { line: token.line, character: token.col },
        end:   { line: token.line, character: token.col + token.length },
      };
      return { contents: { kind: MarkupKind.Markdown, value: md }, range };
    }
    return null;
  }

  const md = buildRegisterMarkdown(info);
  const range: Range = {
    start: { line: token.line, character: token.col },
    end:   { line: token.line, character: token.col + token.length },
  };

  return { contents: { kind: MarkupKind.Markdown, value: md }, range };
}

function buildRegisterMarkdown(info: RegisterInfo): string {
  const lines: string[] = [];

  lines.push(`## ${info.name}`);
  lines.push("");

  const typeLabel = info.type === "int" ? "Integer" : info.type === "float" ? "Floating-Point" : "SIMD Vector";
  lines.push(`**${typeLabel} Register** — ${info.width}`);
  lines.push("");

  lines.push("| Property | Value |");
  lines.push("|----------|-------|");
  lines.push(`| Index    | ${info.index} |`);
  lines.push(`| Type     | ${info.type} |`);
  lines.push(`| Width    | ${info.width} |`);
  lines.push("");

  lines.push(info.description);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Directive hover
// ---------------------------------------------------------------------------

function hoverDirective(token: Token): Hover | null {
  const info = directiveByName.get(token.text.toLowerCase());
  if (!info) return null;

  const md = buildDirectiveMarkdown(info);
  const range: Range = {
    start: { line: token.line, character: token.col },
    end:   { line: token.line, character: token.col + token.length },
  };

  return { contents: { kind: MarkupKind.Markdown, value: md }, range };
}

function buildDirectiveMarkdown(info: DirectiveInfo): string {
  const lines: string[] = [];

  lines.push(`## ${info.name}`);
  lines.push("");
  lines.push(`**${info.description}**`);
  lines.push("");

  lines.push("### Syntax");
  lines.push("");
  lines.push("```fluxasm");
  lines.push(info.syntax);
  lines.push("```");
  lines.push("");

  lines.push("### Detail");
  lines.push("");
  lines.push(info.detail);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Label hover
// ---------------------------------------------------------------------------

function hoverLabel(token: Token, result: ParseResult): Hover | null {
  const name = token.text.toUpperCase();
  const defNode = result.labels.get(name);

  const lines: string[] = [];
  lines.push(`## ${token.text}`);
  lines.push("");

  if (defNode) {
    lines.push(`**Label Definition** — line ${defNode.line + 1}`);
    lines.push("");

    // Count references
    const refs = result.labelRefs.get(name);
    if (refs && refs.length > 0) {
      lines.push(`Referenced ${refs.length} time${refs.length > 1 ? "s" : ""}:`);
      lines.push("");
      for (const ref of refs.slice(0, 5)) {
        lines.push(`- Line ${ref.line + 1}: \`${ref.mnemonic.text} ${ref.operands.map(o => o.text).join(", ")}\``);
      }
      if (refs.length > 5) {
        lines.push(`- ... and ${refs.length - 5} more`);
      }
    } else {
      lines.push("*No references found*");
    }
  } else {
    lines.push(`**Unresolved Label Reference**`);
    lines.push("");
    lines.push(`No definition found for label \`${token.text}\``);
  }

  const range: Range = {
    start: { line: token.line, character: token.col },
    end:   { line: token.line, character: token.col + token.length },
  };

  return { contents: { kind: MarkupKind.Markdown, value: lines.join("\n") }, range };
}
