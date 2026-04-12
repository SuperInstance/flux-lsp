/**
 * FLUX Diagnostic Provider
 *
 * Validates FLUX assembly source and produces LSP Diagnostics.
 * Checks for: unknown mnemonics, invalid registers, undefined labels,
 * malformed immediates, wrong operand counts, duplicate labels, unused labels.
 */

import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver';
import {
    parseFluxAssembly,
    extractLabels,
    extractLabelReferences,
    validateOperandCount,
    isRegister,
    isImmediate,
    isLabelRef,
    ParsedLine,
} from './parser';
import { lookupOpcode } from './opcode-database';

// ─── Main Provider ──────────────────────────────────────────────────────────

/**
 * Validate a FLUX assembly document and return diagnostics.
 *
 * @param source Full document text
 * @returns Array of LSP Diagnostics
 */
export function provideDiagnostics(source: string): Diagnostic[] {
    const lines = parseFluxAssembly(source);
    const labels = extractLabels(lines);
    const labelRefs = extractLabelReferences(lines);
    const diagnostics: Diagnostic[] = [];

    // Pass 0: duplicate label detection
    const labelDefinitionCounts = new Map<string, number[]>();
    for (const line of lines) {
        if (line.label && (line.type === 'label' || line.type === 'opcode')) {
            const existing = labelDefinitionCounts.get(line.label) || [];
            existing.push(line.lineNumber);
            labelDefinitionCounts.set(line.label, existing);
        }
    }
    for (const [name, occurrences] of labelDefinitionCounts) {
        if (occurrences.length > 1) {
            for (const lineNum of occurrences) {
                diagnostics.push(makeDiagnostic(
                    rangeForLine(lineNum),
                    `Duplicate label definition '@${name}'`,
                    DiagnosticSeverity.Error,
                    'flux-duplicate-label',
                ));
            }
        }
    }

    // Pass 1: per-line checks (mnemonics, registers, immediates, operand count)
    for (const line of lines) {
        if (line.type === 'opcode' && line.mnemonic) {
            // Unknown mnemonic
            const opcodeInfo = lookupOpcode(line.mnemonic);
            if (!opcodeInfo) {
                diagnostics.push(makeDiagnostic(
                    line.mnemonicRange || rangeForLine(line.lineNumber),
                    `Unknown mnemonic '${line.mnemonic}'`,
                    DiagnosticSeverity.Error,
                    'flux-unknown-mnemonic',
                ));
                continue; // Skip further checks for unknown mnemonics
            }

            // Operand count validation
            const operandCount = line.operands ? line.operands.length : 0;
            const operandIssue = validateOperandCount(line.mnemonic, operandCount);
            if (operandIssue) {
                diagnostics.push(makeDiagnostic(
                    rangeForLine(line.lineNumber),
                    operandIssue,
                    DiagnosticSeverity.Error,
                    'flux-operand-count',
                ));
            }

            // Per-operand validation
            if (line.operands) {
                const expectedOps = opcodeInfo.operands;
                for (let i = 0; i < Math.min(line.operands.length, expectedOps.length); i++) {
                    const op = line.operands[i];
                    const expected = expectedOps[i];

                    // Skip unused operand slots
                    if (expected.role === '-' || op === '-') continue;

                    // Label references in operand positions
                    if (isLabelRef(op)) continue;

                    // String literals (e.g., SYS "hello")
                    if (op.startsWith('"') && op.endsWith('"')) continue;

                    // Expected register
                    if (expected.role === 'rd' || expected.role === 'rs1' || expected.role === 'rs2') {
                        if (!isRegister(op)) {
                            // Could be an immediate being used where register expected
                            // or an unknown identifier — only warn if it looks like neither
                            if (!isImmediate(op)) {
                                diagnostics.push(makeDiagnostic(
                                    rangeForLine(line.lineNumber),
                                    `Expected register, got '${op}' (operand ${i + 1} of ${line.mnemonic})`,
                                    DiagnosticSeverity.Error,
                                    'flux-invalid-register',
                                ));
                            }
                        } else {
                            // Register exists — check for R16+ (out of range)
                            const regMatch = op.match(/^[RFV](\d+)$/);
                            if (regMatch) {
                                const num = parseInt(regMatch[1]);
                                if (num > 15) {
                                    diagnostics.push(makeDiagnostic(
                                        rangeForLine(line.lineNumber),
                                        `Register ${op} out of range (valid: 0-15)`,
                                        DiagnosticSeverity.Error,
                                        'flux-register-range',
                                    ));
                                }
                            }
                        }
                    }

                    // Expected immediate
                    if (expected.role === 'imm8' || expected.role === 'imm16') {
                        if (!isImmediate(op) && !isRegister(op)) {
                            // Allow registers as immediates in some contexts (pseudo-instructions)
                            // But warn about malformed numbers
                            if (op.match(/^\d/) && !isImmediate(op)) {
                                diagnostics.push(makeDiagnostic(
                                    rangeForLine(line.lineNumber),
                                    `Malformed immediate value '${op}' (operand ${i + 1} of ${line.mnemonic})`,
                                    DiagnosticSeverity.Error,
                                    'flux-malformed-immediate',
                                ));
                            }
                        } else if (isImmediate(op)) {
                            // Range check for imm8
                            if (expected.role === 'imm8') {
                                const val = parseImmediate(op);
                                if (val < -128 || val > 255) {
                                    diagnostics.push(makeDiagnostic(
                                        rangeForLine(line.lineNumber),
                                        `Immediate value ${op} out of range for imm8 (-128 to 255)`,
                                        DiagnosticSeverity.Warning,
                                        'flux-immediate-range',
                                    ));
                                }
                            }
                            // Range check for imm16
                            if (expected.role === 'imm16') {
                                const val = parseImmediate(op);
                                if (val < -32768 || val > 65535) {
                                    diagnostics.push(makeDiagnostic(
                                        rangeForLine(line.lineNumber),
                                        `Immediate value ${op} out of range for imm16 (-32768 to 65535)`,
                                        DiagnosticSeverity.Warning,
                                        'flux-immediate-range',
                                    ));
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Pass 2: undefined label references
    for (const ref of labelRefs) {
        if (!labels.has(ref.name)) {
            diagnostics.push(makeDiagnostic(
                {
                    start: { line: ref.line, character: ref.col },
                    end: { line: ref.line, character: ref.col + ref.name.length + 1 },
                },
                `Undefined label '@${ref.name}'`,
                DiagnosticSeverity.Error,
                'flux-undefined-label',
            ));
        }
    }

    // Pass 3: unused label warnings
    const referencedLabels = new Set(labelRefs.map(r => r.name));
    for (const [name, defLines] of labelDefinitionCounts) {
        if (!referencedLabels.has(name)) {
            // Only warn for labels that are not entry points (@start, @main, @entry)
            const lowerName = name.toLowerCase();
            if (lowerName !== 'start' && lowerName !== 'main' && lowerName !== 'entry' && lowerName !== '_start') {
                // Report on the first definition
                diagnostics.push(makeDiagnostic(
                    rangeForLine(defLines[0]),
                    `Label '@${name}' is defined but never referenced`,
                    DiagnosticSeverity.Hint,
                    'flux-unused-label',
                ));
            }
        }
    }

    return diagnostics;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Create a diagnostic with standard settings.
 */
export function makeDiagnostic(
    range: Range,
    message: string,
    severity: DiagnosticSeverity,
    code: string | number,
): Diagnostic {
    return {
        range,
        message,
        severity,
        code,
        source: 'flux-lsp',
    };
}

/**
 * Create a range spanning an entire line.
 */
export function rangeForLine(line: number): Range {
    return {
        start: { line, character: 0 },
        end: { line, character: 999 },
    };
}

/**
 * Parse an immediate value string to a number.
 */
export function parseImmediate(token: string): number {
    if (token.startsWith('0x') || token.startsWith('0X')) {
        return parseInt(token, 16);
    }
    if (token.startsWith('0b') || token.startsWith('0B')) {
        return parseInt(token.slice(2), 2);
    }
    return parseInt(token, 10);
}
