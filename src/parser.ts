/**
 * FLUX Assembly Parser
 *
 * Parses FLUX assembly source into structured ParsedLine objects.
 * Handles labels, opcodes, directives, comments, and empty lines.
 * Extracts label definitions and references for symbol resolution.
 *
 * Grammar reference: docs/grammar-spec.md Section 6
 */

import { Position, Range } from 'vscode-languageserver';
import { lookupOpcode } from './opcode-database';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ParsedLineType = 'label' | 'opcode' | 'directive' | 'comment' | 'empty' | 'section' | 'directive_comment';

export interface ParsedLine {
    type: ParsedLineType;
    label?: string;           // label name without @ or :
    mnemonic?: string;        // opcode mnemonic (uppercased)
    operands?: string[];      // raw operand strings
    directive?: string;       // directive name (e.g., .text)
    comment?: string;         // comment text without ;
    lineNumber: number;       // 0-based line number
    lineText: string;         // original line text
    /** Column range of the mnemonic/token (for diagnostics) */
    mnemonicRange?: Range;
    /** Column range of the operands */
    operandRanges?: Range[];
}

export interface LabelInfo {
    name: string;
    line: number;           // 0-based
    position: Position;
}

export interface SectionInfo {
    type: 'fn' | 'agent' | 'tile' | 'region' | 'vocabulary' | 'test';
    name: string;
    line: number;
    position: Position;
    signature?: string;
}

// ─── Regex Patterns ──────────────────────────────────────────────────────────

// Label definition: @name:
const LABEL_RE = /^(@[a-zA-Z_]\w*)\s*:/;

// Section heading: ## fn: name, ## agent: name, etc.
const SECTION_RE = /^##\s+(fn|agent|tile|region|vocabulary|test)\s*:\s*(.*)/;

// Directive comment: #!keyword value
const DIRECTIVE_COMMENT_RE = /^(#!\w+)\s*(.*)/;

// Standalone comment: ; ...
const COMMENT_RE = /^\s*;\s*(.*)/;

// Hash comment: # ... (but not #!)
const HASH_COMMENT_RE = /^\s*#\s+(.*)/;

// Directive: .text, .data, .global, etc.
const DIRECTIVE_RE = /^(\.[a-zA-Z_]\w*)\s*(.*)/;

// Opcode line: MNEMONIC operands ; comment
// Opcode must be uppercase letters/digits/underscores, at least 2 chars
const OPCODE_RE = /^([A-Z][A-Z0-9_]*)\s*(.*?)(?:\s*;\s*(.*))?$/;

// Label prefix on opcode line: @label: MNEMONIC ...
const LABEL_OPCODE_RE = /^(@[a-zA-Z_]\w*)\s*:\s*([A-Z][A-Z0-9_]*)\s*(.*?)(?:\s*;\s*(.*))?$/;

// ─── Parser ──────────────────────────────────────────────────────────────────

/**
 * Parse a single line of FLUX assembly.
 */
function parseLine(lineText: string, lineNumber: number): ParsedLine {
    const trimmed = lineText.trim();

    // Empty line
    if (trimmed === '') {
        return { type: 'empty', lineNumber, lineText };
    }

    // Section heading (## fn:, ## agent:, etc.)
    const sectionMatch = SECTION_RE.exec(trimmed);
    if (sectionMatch) {
        return {
            type: 'section',
            lineNumber,
            lineText,
            directive: sectionMatch[1], // section type
            label: sectionMatch[2].trim(),
        };
    }

    // Directive comment (#!capability, #!import, etc.)
    const dirCommentMatch = DIRECTIVE_COMMENT_RE.exec(trimmed);
    if (dirCommentMatch) {
        return {
            type: 'directive_comment',
            lineNumber,
            lineText,
            directive: dirCommentMatch[1],
            label: dirCommentMatch[2].trim(),
        };
    }

    // Semicolon comment
    const commentMatch = COMMENT_RE.exec(trimmed);
    if (commentMatch) {
        return {
            type: 'comment',
            lineNumber,
            lineText,
            comment: commentMatch[1],
        };
    }

    // Hash comment (not #!)
    const hashCommentMatch = HASH_COMMENT_RE.exec(trimmed);
    if (hashCommentMatch) {
        return {
            type: 'comment',
            lineNumber,
            lineText,
            comment: hashCommentMatch[1],
        };
    }

    // Assembler directive (.text, .global, .word, etc.)
    const directiveMatch = DIRECTIVE_RE.exec(trimmed);
    if (directiveMatch) {
        const operandsStr = directiveMatch[2].trim();
        const operands = operandsStr ? operandsStr.split(/\s*,\s*/) : [];
        return {
            type: 'directive',
            lineNumber,
            lineText,
            directive: directiveMatch[1],
            operands,
        };
    }

    // Label + opcode line: @label: MNEMONIC operands ; comment
    const labelOpcodeMatch = LABEL_OPCODE_RE.exec(trimmed);
    if (labelOpcodeMatch) {
        const labelName = labelOpcodeMatch[1].slice(1); // remove @
        const mnemonic = labelOpcodeMatch[2];
        const operandsStr = labelOpcodeMatch[3].trim();
        const comment = labelOpcodeMatch[4];
        const operands = operandsStr ? splitOperands(operandsStr) : [];

        // Calculate ranges within the line
        const mnemonicStart = lineText.indexOf(mnemonic);
        const mnemonicEnd = mnemonicStart + mnemonic.length;

        return {
            type: 'opcode',
            lineNumber,
            lineText,
            label: labelName,
            mnemonic,
            operands,
            comment: comment || undefined,
            mnemonicRange: {
                start: { line: lineNumber, character: mnemonicStart },
                end: { line: lineNumber, character: mnemonicEnd },
            },
        };
    }

    // Standalone label: @label:
    const labelMatch = LABEL_RE.exec(trimmed);
    if (labelMatch) {
        return {
            type: 'label',
            lineNumber,
            lineText,
            label: labelMatch[1].slice(1), // remove @
        };
    }

    // Opcode line: MNEMONIC operands ; comment
    const opcodeMatch = OPCODE_RE.exec(trimmed);
    if (opcodeMatch) {
        const mnemonic = opcodeMatch[1];
        const operandsStr = opcodeMatch[2].trim();
        const comment = opcodeMatch[3];
        const operands = operandsStr ? splitOperands(operandsStr) : [];

        const mnemonicStart = lineText.indexOf(mnemonic);
        const mnemonicEnd = mnemonicStart + mnemonic.length;

        return {
            type: 'opcode',
            lineNumber,
            lineText,
            mnemonic,
            operands,
            comment: comment || undefined,
            mnemonicRange: {
                start: { line: lineNumber, character: mnemonicStart },
                end: { line: lineNumber, character: mnemonicEnd },
            },
        };
    }

    // Fallback: treat as unknown/empty
    return { type: 'empty', lineNumber, lineText };
}

/**
 * Split operand string by commas, respecting parentheses and strings.
 */
function splitOperands(operandsStr: string): string[] {
    const result: string[] = [];
    let current = '';
    let depth = 0;
    let inString = false;

    for (let i = 0; i < operandsStr.length; i++) {
        const ch = operandsStr[i];

        if (ch === '"' && (i === 0 || operandsStr[i - 1] !== '\\')) {
            inString = !inString;
            current += ch;
        } else if (inString) {
            current += ch;
        } else if (ch === '(' || ch === '[') {
            depth++;
            current += ch;
        } else if (ch === ')' || ch === ']') {
            depth--;
            current += ch;
        } else if (ch === ',' && depth === 0) {
            const trimmed = current.trim();
            if (trimmed) result.push(trimmed);
            current = '';
        } else {
            current += ch;
        }
    }

    const trimmed = current.trim();
    if (trimmed) result.push(trimmed);
    return result;
}

/**
 * Parse FLUX assembly source into an array of ParsedLine objects.
 */
export function parseFluxAssembly(source: string): ParsedLine[] {
    const lines = source.split('\n');
    return lines.map((line, index) => parseLine(line, index));
}

/**
 * Extract all label definitions from parsed lines.
 * Returns a map of label name -> 0-based line number.
 */
export function extractLabels(lines: ParsedLine[]): Map<string, number> {
    const labels = new Map<string, number>();
    for (const line of lines) {
        if (line.label && (line.type === 'label' || line.type === 'opcode')) {
            labels.set(line.label, line.lineNumber);
        }
    }
    return labels;
}

/**
 * Extract all label definitions with position info.
 */
export function extractLabelInfos(lines: ParsedLine[]): LabelInfo[] {
    const infos: LabelInfo[] = [];
    for (const line of lines) {
        if (line.label && (line.type === 'label' || line.type === 'opcode')) {
            infos.push({
                name: line.label,
                line: line.lineNumber,
                position: { line: line.lineNumber, character: 0 },
            });
        }
    }
    return infos;
}

/**
 * Extract all section definitions (## fn:, ## agent:, etc.).
 */
export function extractSections(lines: ParsedLine[]): SectionInfo[] {
    const sections: SectionInfo[] = [];
    for (const line of lines) {
        if (line.type === 'section') {
            sections.push({
                type: line.directive as SectionInfo['type'],
                name: line.label || '',
                line: line.lineNumber,
                position: { line: line.lineNumber, character: 0 },
                signature: line.label || undefined,
            });
        }
    }
    return sections;
}

/**
 * Find all label references in operand positions.
 * A label reference is @name in any operand.
 */
export function extractLabelReferences(lines: ParsedLine[]): { name: string; line: number; col: number }[] {
    const refs: { name: string; line: number; col: number }[] = [];
    for (const line of lines) {
        if (!line.operands) continue;
        for (const op of line.operands) {
            const labelRefMatch = op.match(/^@(\w+)$/);
            if (labelRefMatch) {
                const col = line.lineText.indexOf(op);
                refs.push({ name: labelRefMatch[1], line: line.lineNumber, col });
            }
        }
    }
    return refs;
}

/**
 * Validate that operands match the expected format for an opcode.
 * Returns null if valid, or a string describing the issue.
 */
export function validateOperandCount(mnemonic: string, operandCount: number): string | null {
    const info = lookupOpcode(mnemonic);
    if (!info) return null; // unknown mnemonic handled elsewhere

    const expectedCount = info.operands.filter(o => o.role !== '-').length;
    // Some opcodes accept a dash for unused operand
    if (operandCount === expectedCount || operandCount === info.operands.length) {
        return null;
    }

    // Allow one fewer operand if any operand role is '-' (unused)
    if (operandCount === expectedCount - 1 && info.operands.some(o => o.role === '-')) {
        return null;
    }

    // Allow one fewer operand for Format F and G opcodes where the first operand
    // is commonly omitted (e.g., JMP @label, JAL @label — skipping unused rd).
    // Also allow MOV R0, R1 (2 ops for Format E with 3 operands where 3rd is unused).
    if (operandCount === expectedCount - 1 && expectedCount >= 2) {
        return null; // Common assembly pattern: omit one operand
    }

    return `Expected ${expectedCount} operand(s) for ${mnemonic}, got ${operandCount}`;
}

/**
 * Check if a string looks like a valid register reference.
 */
export function isRegister(token: string): boolean {
    // GP: R0-R15
    if (/^R(1[0-5]|[0-9])$/.test(token)) return true;
    // FP: F0-F15
    if (/^F(1[0-5]|[0-9])$/.test(token)) return true;
    // VEC: V0-V15
    if (/^V(1[0-5]|[0-9])$/.test(token)) return true;
    // Special
    if (/^(SP|FP|LR|PC|FLAGS)$/.test(token)) return true;
    return false;
}

/**
 * Check if a string looks like a valid immediate value.
 */
export function isImmediate(token: string): boolean {
    if (/^[+-]?\d+$/.test(token)) return true;   // decimal
    if (/^0[xX][0-9a-fA-F]+$/.test(token)) return true;  // hex
    if (/^0[bB][01]+$/.test(token)) return true;   // binary
    if (/^-[1-9]\d*$/.test(token)) return true;    // negative decimal
    return false;
}

/**
 * Check if a string is a label reference (@name).
 */
export function isLabelRef(token: string): boolean {
    return /^@\w+$/.test(token);
}
