/**
 * completion.ts — Autocomplete provider for .fluxasm files
 *
 * Provides context-aware completions for:
 * - Opcode mnemonics with operand snippets
 * - Register names (R0–R15, F0–F15, V0–V15)
 * - Directives (.byte, .word, .org, .text, .data, etc.)
 * - Label references within the current document
 *
 * Context detection:
 * - Line start → opcodes, directives, labels
 * - After mnemonic → registers, immediates, labels (based on operand position)
 * - After .directive → directive-specific completions
 */

import {
  CompletionItem,
  CompletionItemKind,
  CompletionList,
  InsertTextFormat,
  Position,
  TextEdit,
} from "vscode-languageserver-protocol";
import { ParseResult, TokenType, getTokenAtPosition } from "./parser";
import {
  opcodeByName,
  registerByName,
  directiveByName,
  ALL_MNEMONICS,
  ALL_REGISTER_NAMES,
  ALL_DIRECTIVE_NAMES,
  CATEGORY_LABELS,
  OpcodeCategory,
  OpcodeEntry,
} from "./opcode_db";

// ---------------------------------------------------------------------------
// Context detection
// ---------------------------------------------------------------------------

type CompletionContext = "mnemonic" | "directive" | "operand-register" | "operand-label" | "operand-immediate" | "unknown";

function detectContext(result: ParseResult, line: number, character: number): CompletionContext {
  // Get tokens on this line before the cursor
  const lineTokens = result.tokens.filter(
    t => t.line === line && t.col + t.length <= character && t.type !== TokenType.Whitespace
  );

  if (lineTokens.length === 0) {
    // Empty line or only whitespace — expect mnemonic or directive
    return "mnemonic";
  }

  const firstToken = lineTokens[0];

  // If first token is a directive
  if (firstToken.type === TokenType.Directive) {
    return "directive";
  }

  // If first token is a mnemonic, we're in operand position
  if (firstToken.type === TokenType.Mnemonic) {
    const entry = opcodeByName.get(firstToken.text.toUpperCase());
    if (entry) {
      // Count commas to determine which operand position we're at
      const commaCount = lineTokens.filter(t => t.type === TokenType.Comma).length;
      const operandIndex = commaCount; // 0-based

      if (operandIndex < entry.operands.length) {
        const expectedType = entry.operands[operandIndex];
        if (expectedType.startsWith("r") || expectedType.startsWith("f") || expectedType.startsWith("v")) {
          return "operand-register";
        }
        if (expectedType === "label") {
          return "operand-label";
        }
        if (expectedType.startsWith("imm")) {
          return "operand-immediate";
        }
      }

      // Past expected operand count, but still — offer registers/labels
      return "operand-register";
    }
    return "operand-register";
  }

  // After label definition
  if (firstToken.type === TokenType.LabelDef) {
    if (lineTokens.length <= 2) {
      return "mnemonic";
    }
    // Continue with whatever follows label
    return "mnemonic";
  }

  return "unknown";
}

// ---------------------------------------------------------------------------
// Main completion provider
// ---------------------------------------------------------------------------

export function getCompletions(result: ParseResult, position: Position): CompletionList {
  const ctx = detectContext(result, position.line, position.character);
  const items: CompletionItem[] = [];

  switch (ctx) {
    case "mnemonic":
      items.push(...mnemonicCompletions());
      items.push(...directiveCompletions());
      items.push(...labelCompletions(result));
      break;
    case "operand-register":
      items.push(...registerCompletions());
      items.push(...labelCompletions(result));
      break;
    case "operand-label":
      items.push(...labelCompletions(result));
      items.push(...registerCompletions());
      break;
    case "operand-immediate":
      // No specific completions for immediates, but offer labels
      items.push(...labelCompletions(result));
      break;
    case "directive":
      // Directive arguments — context-specific
      break;
    default:
      // Fallback: offer everything
      items.push(...mnemonicCompletions());
      items.push(...directiveCompletions());
      items.push(...registerCompletions());
      items.push(...labelCompletions(result));
      break;
  }

  return { isIncomplete: false, items };
}

// ---------------------------------------------------------------------------
// Mnemonic completions with snippets
// ---------------------------------------------------------------------------

let mnemonicItems: CompletionItem[] | null = null;

function mnemonicCompletions(): CompletionItem[] {
  if (mnemonicItems) return mnemonicItems;

  const items: CompletionItem[] = [];
  let idx = 0;

  // Group by category for better organization
  const byCategory = new Map<OpcodeCategory, OpcodeEntry[]>();
  for (const entry of opcodeByName.values()) {
    const list = byCategory.get(entry.category) ?? [];
    list.push(entry);
    byCategory.set(entry.category, list);
  }

  for (const [category, entries] of byCategory) {
    for (const entry of entries) {
      // Build snippet text with tab stops
      const snippetParts: string[] = [];
      for (let i = 0; i < entry.operands.length; i++) {
        const opType = entry.operands[i];
        const placeholder = operandPlaceholder(opType, i);
        snippetParts.push(`\${${i + 1}:${placeholder}}`);
      }

      const snippet = snippetParts.length > 0
        ? `${entry.name} ${snippetParts.join(", ")}`
        : entry.name;

      items.push({
        label: entry.name,
        kind: CompletionItemKind.Function,
        detail: `${entry.hex} — ${entry.description}`,
        documentation: {
          kind: "markdown",
          value: [
            `**${entry.name}** \`${entry.hex}\``,
            "",
            entry.description,
            "",
            `Format: ${entry.format} | Size: ${entry.size > 0 ? entry.size + "B" : "var"}`,
            "",
            `\`${entry.name} ${entry.operandStr}\``,
          ].join("\n"),
        },
        insertText: snippet,
        insertTextFormat: InsertTextFormat.Snippet,
        sortText: sortKey(category, idx),
        filterText: entry.name.toLowerCase(),
        data: { category },
      });
      idx++;
    }
  }

  mnemonicItems = items;
  return items;
}

function operandPlaceholder(opType: string, index: number): string {
  const placeholders: Record<string, string> = {
    rd: `R${Math.min(index, 15)}`,
    rs: `R${Math.min(index + 1, 15)}`,
    rt: `R${Math.min(index + 2, 15)}`,
    fd: `F${Math.min(index, 15)}`,
    fs: `F${Math.min(index + 1, 15)}`,
    ft: `F${Math.min(index + 2, 15)}`,
    vd: `V${Math.min(index, 15)}`,
    vs: `V${Math.min(index + 1, 15)}`,
    vt: `V${Math.min(index + 2, 15)}`,
    imm8: "imm8",
    imm16: "imm16",
    imm32: "imm32",
    label: "label",
    addr: "addr",
  };
  return placeholders[opType] ?? "operand";
}

function sortKey(category: OpcodeCategory, index: number): string {
  // Prioritize common categories
  const priority: Record<OpcodeCategory, number> = {
    control: 1,
    integer: 2,
    compare: 3,
    function: 4,
    stack: 5,
    bitwise: 6,
    float: 7,
    simd: 8,
    memory: 9,
    type: 10,
    a2a: 11,
    system: 12,
    confidence: 13,
    viewpoint: 14,
  };
  const p = priority[category] ?? 99;
  return `${p.toString().padStart(2, "0")}_${index.toString().padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Register completions
// ---------------------------------------------------------------------------

let registerItems: CompletionItem[] | null = null;

function registerCompletions(): CompletionItem[] {
  if (registerItems) return registerItems;

  const items: CompletionItem[] = [];

  for (const info of registerByName.values()) {
    const typeIcon = info.type === "int" ? "🔢" : info.type === "float" ? "<decimal>" : "📡";
    const typeLabel = info.type === "int" ? "Integer" : info.type === "float" ? "Float" : "SIMD";

    items.push({
      label: info.name,
      kind: CompletionItemKind.Variable,
      detail: `${typeLabel} Register — ${info.width}`,
      documentation: info.description,
      insertText: info.name,
      insertTextFormat: InsertTextFormat.PlainText,
      sortText: info.type === "int" ? `0_${info.index.toString().padStart(2, "0")}` :
                info.type === "float" ? `1_${info.index.toString().padStart(2, "0")}` :
                `2_${info.index.toString().padStart(2, "0")}`,
    });
  }

  registerItems = items;
  return items;
}

// ---------------------------------------------------------------------------
// Directive completions
// ---------------------------------------------------------------------------

let directiveItems: CompletionItem[] | null = null;

function directiveCompletions(): CompletionItem[] {
  if (directiveItems) return directiveItems;

  const items: CompletionItem[] = [];

  for (const info of directiveByName.values()) {
    items.push({
      label: info.name,
      kind: CompletionItemKind.Keyword,
      detail: info.description,
      documentation: {
        kind: "markdown",
        value: [
          `**${info.name}**`,
          "",
          info.description,
          "",
          "```fluxasm",
          info.syntax,
          "```",
          "",
          info.detail,
        ].join("\n"),
      },
      insertText: directiveSnippet(info),
      insertTextFormat: InsertTextFormat.Snippet,
      sortText: `9_${info.name}`,
    });
  }

  directiveItems = items;
  return items;
}

function directiveSnippet(info: { name: string; syntax: string }): string {
  switch (info.name) {
    case ".byte":
    case ".word":
    case ".dword":
      return `${info.name} \${1:value}`;
    case ".org":
      return `${info.name} \${1:address}`;
    case ".text":
    case ".data":
    case ".bss":
      return info.name;
    case ".align":
      return `${info.name} \${1:n}`;
    case ".global":
    case ".extern":
      return `${info.name} \${1:name}`;
    case ".include":
      return `${info.name} "\${1:filename}"`;
    case ".ascii":
    case ".asciz":
      return `${info.name} "\${1:string}"`;
    case ".space":
      return `${info.name} \${1:n}`;
    case ".fill":
      return `${info.name} \${1:n}, \${2:value}`;
    case ".set":
      return `${info.name} \${1:name}, \${2:value}`;
    case ".macro":
      return `${info.name} \${1:name}\n\t\$0\n.endm`;
    case ".endm":
      return info.name;
    default:
      return info.name;
  }
}

// ---------------------------------------------------------------------------
// Label completions
// ---------------------------------------------------------------------------

function labelCompletions(result: ParseResult): CompletionItem[] {
  const items: CompletionItem[] = [];

  for (const [name, node] of result.labels) {
    items.push({
      label: node.name.text,
      kind: CompletionItemKind.Reference,
      detail: `Label — line ${node.line + 1}`,
      insertText: node.name.text,
      insertTextFormat: InsertTextFormat.PlainText,
      sortText: `8_${name}`,
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Trigger characters
// ---------------------------------------------------------------------------

/** Characters that should trigger completion in .fluxasm files */
export const TRIGGER_CHARACTERS = [".", "R", "F", "V", " "];
