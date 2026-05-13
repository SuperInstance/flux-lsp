/**
 * parser.ts — .fluxasm tokenizer, parser, and AST representation
 *
 * Parses FLUX assembly source text into a structured AST with error recovery.
 * Supports incremental re-parsing for LSP document synchronization.
 */

import { opcodeByName, registerByName, directiveByName } from "./opcode_db";

// ---------------------------------------------------------------------------
// Token Types
// ---------------------------------------------------------------------------

export enum TokenType {
  /** Instruction mnemonic (e.g. MOV, IADD) */
  Mnemonic,
  /** Register name (e.g. R0, F3, V15) */
  Register,
  /** Label definition (e.g. loop:) */
  LabelDef,
  /** Label reference (e.g. jump target) */
  LabelRef,
  /** Directive (e.g. .text, .byte) */
  Directive,
  /** Numeric immediate (decimal, hex 0x.., binary 0b..) */
  Immediate,
  /** Comma separator */
  Comma,
  /** Colon separator */
  Colon,
  /** Comment (; ...) */
  Comment,
  /** Whitespace */
  Whitespace,
  /** Unknown / error token */
  Unknown,
  /** End of line */
  EOL,
}

export interface Token {
  type: TokenType;
  text: string;
  /** 0-based line number */
  line: number;
  /** 0-based character offset within line */
  col: number;
  /** 0-based absolute offset in document */
  offset: number;
  /** Length of token text */
  length: number;
}

// ---------------------------------------------------------------------------
// AST Node Types
// ---------------------------------------------------------------------------

export type ASTNode =
  | InstructionNode
  | LabelDefNode
  | DirectiveNode
  | SectionNode
  | CommentNode
  | ErrorNode;

export interface InstructionNode {
  kind: "instruction";
  /** Mnemonic token */
  mnemonic: Token;
  /** Operand tokens (registers, immediates, labels) */
  operands: Token[];
  /** Inline comment if present */
  comment?: Token;
  /** 0-based line number */
  line: number;
}

export interface LabelDefNode {
  kind: "label";
  /** Label name (without colon) */
  name: Token;
  /** Colon token */
  colon: Token;
  /** 0-based line number */
  line: number;
}

export interface DirectiveNode {
  kind: "directive";
  /** Directive token (e.g. .byte) */
  directive: Token;
  /** Arguments after directive */
  args: Token[];
  /** 0-based line number */
  line: number;
}

export interface SectionNode {
  kind: "section";
  /** Section directive token */
  directive: Token;
  /** Section name (.text or .data etc.) */
  sectionName: string;
  /** 0-based line number */
  line: number;
}

export interface CommentNode {
  kind: "comment";
  /** Comment token */
  comment: Token;
  /** 0-based line number */
  line: number;
}

export interface ErrorNode {
  kind: "error";
  /** The token that caused the error */
  token: Token;
  /** Error message */
  message: string;
  /** 0-based line number */
  line: number;
}

// ---------------------------------------------------------------------------
// Parse Result
// ---------------------------------------------------------------------------

export interface ParseResult {
  /** All AST nodes in document order */
  nodes: ASTNode[];
  /** All tokens in document order */
  tokens: Token[];
  /** Label definitions: name → node */
  labels: Map<string, LabelDefNode>;
  /** Label references: name → referencing nodes */
  labelRefs: Map<string, InstructionNode[]>;
  /** Section names found */
  sections: string[];
  /** Opcodes used in document */
  usedOpcodes: Set<string>;
  /** Line → list of nodes on that line */
  lines: Map<number, ASTNode[]>;
  /** Total line count */
  lineCount: number;
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

const RE_MNEMONIC = /^[A-Z][A-Z0-9_]*$/i;
const RE_REGISTER = /^[RFV]\d+$/i;
const RE_LABEL_DEF = /^\.?[A-Za-z_][A-Za-z0-9_]*:$/;
const RE_LABEL_REF = /^\.?[A-Za-z_][A-Za-z0-9_]*$/;
const RE_IMMEDIATE = /^(0x[0-9A-Fa-f]+|0b[01]+|-?\d+)$/;

export function tokenizeLine(line: string, lineNum: number, lineOffset: number): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  const len = line.length;

  while (pos < len) {
    const ch = line[pos];

    // Whitespace
    if (ch === " " || ch === "\t") {
      const start = pos;
      while (pos < len && (line[pos] === " " || line[pos] === "\t")) pos++;
      tokens.push({
        type: TokenType.Whitespace,
        text: line.slice(start, pos),
        line: lineNum,
        col: start,
        offset: lineOffset + start,
        length: pos - start,
      });
      continue;
    }

    // Comment
    if (ch === ";") {
      tokens.push({
        type: TokenType.Comment,
        text: line.slice(pos),
        line: lineNum,
        col: pos,
        offset: lineOffset + pos,
        length: len - pos,
      });
      pos = len;
      continue;
    }

    // Comma
    if (ch === ",") {
      tokens.push({ type: TokenType.Comma, text: ",", line: lineNum, col: pos, offset: lineOffset + pos, length: 1 });
      pos++;
      continue;
    }

    // Colon
    if (ch === ":") {
      tokens.push({ type: TokenType.Colon, text: ":", line: lineNum, col: pos, offset: lineOffset + pos, length: 1 });
      pos++;
      continue;
    }

    // Directive (starts with .)
    if (ch === ".") {
      const start = pos;
      while (pos < len && /[A-Za-z0-9_]/.test(line[pos])) pos++;
      const text = line.slice(start, pos);
      tokens.push({
        type: TokenType.Directive,
        text,
        line: lineNum,
        col: start,
        offset: lineOffset + start,
        length: pos - start,
      });
      continue;
    }

    // Word (mnemonic, register, label, immediate)
    if (/[A-Za-z0-9_\-#]/.test(ch)) {
      const start = pos;
      if (ch === "#" || ch === "-") pos++; // allow #prefix and -negative
      while (pos < len && /[A-Za-z0-9_]/.test(line[pos])) pos++;
      const text = line.slice(start, pos);

      // Classify the word token
      let type: TokenType;
      const upper = text.toUpperCase();

      if (opcodeByName.has(upper)) {
        type = TokenType.Mnemonic;
      } else if (RE_REGISTER.test(upper) && registerByName.has(upper)) {
        type = TokenType.Register;
      } else if (text.endsWith(":") || (RE_LABEL_DEF.test(text))) {
        type = TokenType.LabelDef;
      } else if (RE_IMMEDIATE.test(text)) {
        type = TokenType.Immediate;
      } else if (RE_LABEL_REF.test(text)) {
        type = TokenType.LabelRef;
      } else if (RE_REGISTER.test(upper)) {
        // Looks like a register but invalid index (e.g. R16, F20)
        type = TokenType.Register;
      } else {
        type = TokenType.Unknown;
      }

      tokens.push({
        type,
        text,
        line: lineNum,
        col: start,
        offset: lineOffset + start,
        length: pos - start,
      });
      continue;
    }

    // Unknown character
    tokens.push({
      type: TokenType.Unknown,
      text: ch,
      line: lineNum,
      col: pos,
      offset: lineOffset + pos,
      length: 1,
    });
    pos++;
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export function parse(text: string): ParseResult {
  const lines = text.split("\n");
  const nodes: ASTNode[] = [];
  const allTokens: Token[] = [];
  const labels = new Map<string, LabelDefNode>();
  const labelRefs = new Map<string, InstructionNode[]>();
  const sections: string[] = [];
  const usedOpcodes = new Set<string>();
  const lineMap = new Map<number, ASTNode[]>();
  let lineOffset = 0;

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const rawLine = lines[lineNum];
    const tokens = tokenizeLine(rawLine, lineNum, lineOffset);
    allTokens.push(...tokens);

    // Filter out whitespace for parsing
    const meaningful = tokens.filter(
      t => t.type !== TokenType.Whitespace && t.type !== TokenType.EOL
    );

    if (meaningful.length === 0) {
      lineOffset += rawLine.length + 1; // +1 for \n
      continue;
    }

    // Check for comment-only line
    if (meaningful.length === 1 && meaningful[0].type === TokenType.Comment) {
      const node: CommentNode = {
        kind: "comment",
        comment: meaningful[0],
        line: lineNum,
      };
      nodes.push(node);
      addLineNode(lineMap, lineNum, node);
      lineOffset += rawLine.length + 1;
      continue;
    }

    // Split meaningful tokens into parts separated by comment
    let commentToken: Token | undefined;
    const beforeComment: Token[] = [];
    let foundComment = false;
    for (const t of meaningful) {
      if (t.type === TokenType.Comment) {
        commentToken = t;
        foundComment = true;
      } else if (!foundComment) {
        beforeComment.push(t);
      }
    }

    // Check if this is a label definition
    // Pattern: LabelDef token, or identifier followed by Colon
    let labelDefHandled = false;

    if (beforeComment.length >= 2) {
      const first = beforeComment[0];
      const second = beforeComment[1];
      if (first.type === TokenType.LabelDef) {
        // Label defined with colon attached (e.g. "loop:")
        const nameText = first.text.replace(/:$/, "");
        const node: LabelDefNode = {
          kind: "label",
          name: { ...first, text: nameText },
          colon: { type: TokenType.Colon, text: ":", line: first.line, col: first.col + first.text.length - 1, offset: first.offset + first.text.length - 1, length: 1 },
          line: lineNum,
        };
        nodes.push(node);
        labels.set(nameText.toUpperCase(), node);
        addLineNode(lineMap, lineNum, node);
        labelDefHandled = true;

        // Parse remaining tokens on same line as instruction
        const remaining = beforeComment.slice(1);
        if (remaining.length > 0) {
          parseInstructionOrDirective(remaining, lineNum, commentToken, nodes, labelRefs, usedOpcodes, lineMap, sections);
        }
      } else if (first.type === TokenType.Unknown && second.type === TokenType.Colon) {
        // Label defined as "name :" with separate colon
        const node: LabelDefNode = {
          kind: "label",
          name: first,
          colon: second,
          line: lineNum,
        };
        nodes.push(node);
        labels.set(first.text.toUpperCase(), node);
        addLineNode(lineMap, lineNum, node);
        labelDefHandled = true;

        const remaining = beforeComment.slice(2);
        if (remaining.length > 0) {
          parseInstructionOrDirective(remaining, lineNum, commentToken, nodes, labelRefs, usedOpcodes, lineMap, sections);
        }
      }
    } else if (beforeComment.length === 1 && beforeComment[0].type === TokenType.LabelDef) {
      // Label only line
      const first = beforeComment[0];
      const nameText = first.text.replace(/:$/, "");
      const node: LabelDefNode = {
        kind: "label",
        name: { ...first, text: nameText },
        colon: { type: TokenType.Colon, text: ":", line: first.line, col: first.col + first.text.length - 1, offset: first.offset + first.text.length - 1, length: 1 },
        line: lineNum,
      };
      nodes.push(node);
      labels.set(nameText.toUpperCase(), node);
      addLineNode(lineMap, lineNum, node);
      labelDefHandled = true;
    }

    if (!labelDefHandled && beforeComment.length > 0) {
      parseInstructionOrDirective(beforeComment, lineNum, commentToken, nodes, labelRefs, usedOpcodes, lineMap, sections);
    }

    // Add comment node if standalone
    if (commentToken && beforeComment.length === 0) {
      const node: CommentNode = { kind: "comment", comment: commentToken, line: lineNum };
      nodes.push(node);
      addLineNode(lineMap, lineNum, node);
    }

    lineOffset += rawLine.length + 1;
  }

  return {
    nodes,
    tokens: allTokens,
    labels,
    labelRefs,
    sections,
    usedOpcodes,
    lines: lineMap,
    lineCount: lines.length,
  };
}

function parseInstructionOrDirective(
  tokens: Token[],
  lineNum: number,
  comment: Token | undefined,
  nodes: ASTNode[],
  labelRefs: Map<string, InstructionNode[]>,
  usedOpcodes: Set<string>,
  lineMap: Map<number, ASTNode[]>,
  sections: string[],
): void {
  const first = tokens[0];

  // Directive?
  if (first.type === TokenType.Directive) {
    const dirName = first.text.toLowerCase();

    // Section directive?
    if (dirName === ".text" || dirName === ".data" || dirName === ".bss") {
      const node: SectionNode = {
        kind: "section",
        directive: first,
        sectionName: dirName,
        line: lineNum,
      };
      nodes.push(node);
      addLineNode(lineMap, lineNum, node);
      if (!sections.includes(dirName)) sections.push(dirName);
      return;
    }

    const args = tokens.slice(1).filter(t => t.type !== TokenType.Comma);
    const node: DirectiveNode = {
      kind: "directive",
      directive: first,
      args,
      line: lineNum,
    };
    nodes.push(node);
    addLineNode(lineMap, lineNum, node);
    return;
  }

  // Instruction
  if (first.type === TokenType.Mnemonic || first.type === TokenType.Unknown) {
    const operands: Token[] = [];
    for (let i = 1; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.type === TokenType.Comma) continue;
      if (t.type === TokenType.Comment) break;
      operands.push(t);

      // Track label references
      if (t.type === TokenType.LabelRef || (t.type === TokenType.Unknown && /^[A-Za-z_]/.test(t.text))) {
        // Could be a label reference used as jump target
      }
    }

    const node: InstructionNode = {
      kind: "instruction",
      mnemonic: first,
      operands,
      comment,
      line: lineNum,
    };
    nodes.push(node);
    addLineNode(lineMap, lineNum, node);

    // Track opcode usage
    if (first.type === TokenType.Mnemonic) {
      usedOpcodes.add(first.text.toUpperCase());
    }

    // Track label references in operands
    for (const op of operands) {
      if (op.type === TokenType.LabelRef || (op.type === TokenType.Unknown && /^[A-Za-z_]/.test(op.text))) {
        const refName = op.text.toUpperCase();
        const refs = labelRefs.get(refName) ?? [];
        refs.push(node);
        labelRefs.set(refName, refs);
      }
    }

    return;
  }

  // Fallback: error node
  const node: ErrorNode = {
    kind: "error",
    token: first,
    message: `Unexpected token: ${first.text}`,
    line: lineNum,
  };
  nodes.push(node);
  addLineNode(lineMap, lineNum, node);
}

function addLineNode(lineMap: Map<number, ASTNode[]>, line: number, node: ASTNode): void {
  const list = lineMap.get(line) ?? [];
  list.push(node);
  lineMap.set(line, list);
}

// ---------------------------------------------------------------------------
// Position helpers
// ---------------------------------------------------------------------------

/** Convert 0-based line/col to absolute offset in text */
export function lineColToOffset(text: string, line: number, col: number): number {
  const lines = text.split("\n");
  let offset = 0;
  for (let i = 0; i < line && i < lines.length; i++) {
    offset += lines[i].length + 1; // +1 for \n
  }
  return offset + col;
}

/** Find the token at a given position (0-based line, 0-based character) */
export function getTokenAtPosition(tokens: Token[], line: number, col: number): Token | undefined {
  for (const t of tokens) {
    if (t.type === TokenType.Whitespace || t.type === TokenType.EOL) continue;
    if (t.line === line && col >= t.col && col < t.col + t.length) {
      return t;
    }
  }
  // Fallback: check for col at end of token (cursor right after)
  for (const t of tokens) {
    if (t.type === TokenType.Whitespace || t.type === TokenType.EOL) continue;
    if (t.line === line && col === t.col + t.length) {
      return t;
    }
  }
  return undefined;
}

/** Get the word at position, expanding beyond single token for compound identifiers */
export function getWordAtPosition(text: string, line: number, col: number): string | undefined {
  const lines = text.split("\n");
  if (line >= lines.length) return undefined;
  const lineText = lines[line];
  if (col >= lineText.length) return undefined;

  // Find word boundaries
  let start = col;
  let end = col;
  while (start > 0 && /[A-Za-z0-9_]/.test(lineText[start - 1])) start--;
  while (end < lineText.length && /[A-Za-z0-9_]/.test(lineText[end])) end++;

  if (start === end) return undefined;
  return lineText.slice(start, end);
}
