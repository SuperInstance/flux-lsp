/**
 * Diagnostics Tests — FLUX Diagnostic Provider
 *
 * Tests error detection, warnings, and validation logic.
 */

import { provideDiagnostics } from '../diagnostics';
import { DiagnosticSeverity } from 'vscode-languageserver';

// ═══════════════════════════════════════════════════════════════════════════════
// Valid code — no diagnostics
// ═══════════════════════════════════════════════════════════════════════════════

describe('provideDiagnostics — valid code', () => {
    test('no diagnostics for empty source', () => {
        const diags = provideDiagnostics('');
        expect(diags).toHaveLength(0);
    });

    test('no diagnostics for comments only', () => {
        const diags = provideDiagnostics('; just a comment\n; another comment');
        expect(diags).toHaveLength(0);
    });

    test('no diagnostics for valid NOP', () => {
        const diags = provideDiagnostics('NOP');
        expect(diags).toHaveLength(0);
    });

    test('no diagnostics for valid HALT', () => {
        const diags = provideDiagnostics('HALT');
        expect(diags).toHaveLength(0);
    });

    test('no diagnostics for valid ADD with registers', () => {
        const diags = provideDiagnostics('ADD R1, R2, R3');
        expect(diags).toHaveLength(0);
    });

    test('no diagnostics for valid MOVI with register and immediate', () => {
        const diags = provideDiagnostics('MOVI R1, 42');
        expect(diags).toHaveLength(0);
    });

    test('no diagnostics for valid MOV with unused operand slot', () => {
        const diags = provideDiagnostics('MOV R1, R2');
        expect(diags).toHaveLength(0);
    });

    test('no diagnostics for SWP with dash unused operand', () => {
        const diags = provideDiagnostics('SWP R1, R2, -');
        expect(diags).toHaveLength(0);
    });

    test('no diagnostics for JMP with label reference', () => {
        const source = '@target:\nJMP R0, @target';
        const diags = provideDiagnostics(source);
        expect(diags).toHaveLength(0);
    });

    test('no diagnostics for multi-line valid program', () => {
        const source = [
            'MOVI R1, 42',
            'MOVI R2, 10',
            'ADD R3, R1, R2',
            'HALT',
        ].join('\n');
        const diags = provideDiagnostics(source);
        expect(diags).toHaveLength(0);
    });

    test('no diagnostics for labels, comments, and directives', () => {
        const source = [
            '; program start',
            '.text',
            '@main:',
            '  NOP',
            '  HALT',
        ].join('\n');
        const diags = provideDiagnostics(source);
        expect(diags).toHaveLength(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Unknown mnemonic
// ═══════════════════════════════════════════════════════════════════════════════

describe('provideDiagnostics — unknown mnemonic', () => {
    test('detects unknown mnemonic', () => {
        const diags = provideDiagnostics('FOOBAR R1, R2');
        expect(diags.length).toBeGreaterThanOrEqual(1);
        expect(diags[0].message).toContain("Unknown mnemonic");
        expect(diags[0].severity).toBe(DiagnosticSeverity.Error);
    });

    test('unknown mnemonic code is flux-unknown-mnemonic', () => {
        const diags = provideDiagnostics('BOGUS R1');
        expect(diags[0].code).toBe('flux-unknown-mnemonic');
    });

    test('detects multiple unknown mnemonics', () => {
        const diags = provideDiagnostics('XXX\nYYY');
        expect(diags.length).toBeGreaterThanOrEqual(2);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Operand validation
// ═══════════════════════════════════════════════════════════════════════════════

describe('provideDiagnostics — operand validation', () => {
    test('detects wrong number of operands', () => {
        // ADD requires 3 operands
        const diags = provideDiagnostics('ADD R1, R2');
        expect(diags.length).toBeGreaterThanOrEqual(1);
        expect(diags.some(d => d.message.includes('operand'))).toBe(true);
    });

    test('code for operand count error is flux-operand-count', () => {
        const diags = provideDiagnostics('ADD R1');
        const operandDiag = diags.find(d => d.code === 'flux-operand-count');
        expect(operandDiag).toBeDefined();
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Register validation
// ═══════════════════════════════════════════════════════════════════════════════

describe('provideDiagnostics — register validation', () => {
    test('detects invalid register name in expected register slot', () => {
        // Using a non-register identifier where register expected
        const diags = provideDiagnostics('ADD foo, R2, R3');
        expect(diags.length).toBeGreaterThanOrEqual(1);
        expect(diags[0].severity).toBe(DiagnosticSeverity.Error);
        expect(diags[0].message).toContain('Expected register');
    });

    test('allows immediate where register expected (soft pass)', () => {
        // Using immediate where register is expected — allowed as soft pass
        const diags = provideDiagnostics('ADD R1, 42, R3');
        // Immediates where registers expected: code allows them (no error)
        // Since 42 is immediate, not unknown identifier, no error should fire
        const registerErrors = diags.filter(d => d.code === 'flux-invalid-register');
        expect(registerErrors).toHaveLength(0);
    });

    test('code for invalid register is flux-invalid-register', () => {
        const diags = provideDiagnostics('ADD badname, R2, R3');
        const regDiag = diags.find(d => d.code === 'flux-invalid-register');
        expect(regDiag).toBeDefined();
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Label references
// ═══════════════════════════════════════════════════════════════════════════════

describe('provideDiagnostics — label references', () => {
    test('detects undefined label reference', () => {
        const diags = provideDiagnostics('JMP R0, @nonexistent');
        expect(diags.length).toBeGreaterThanOrEqual(1);
        const labelDiag = diags.find(d => d.code === 'flux-undefined-label');
        expect(labelDiag).toBeDefined();
        expect(labelDiag!.message).toContain('Undefined label');
        expect(labelDiag!.message).toContain('@nonexistent');
    });

    test('no undefined label error when label is defined', () => {
        const source = '@target:\nJMP R0, @target';
        const diags = provideDiagnostics(source);
        const labelDiag = diags.find(d => d.code === 'flux-undefined-label');
        expect(labelDiag).toBeUndefined();
    });

    test('detects multiple undefined labels', () => {
        const source = 'JMP R0, @foo\nJMP R1, @bar';
        const diags = provideDiagnostics(source);
        const labelDiags = diags.filter(d => d.code === 'flux-undefined-label');
        expect(labelDiags.length).toBeGreaterThanOrEqual(2);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Diagnostic metadata
// ═══════════════════════════════════════════════════════════════════════════════

describe('provideDiagnostics — metadata', () => {
    test('all diagnostics have source flux-lsp', () => {
        const diags = provideDiagnostics('FOOBAR\nADD badname, R2, R3');
        for (const d of diags) {
            expect(d.source).toBe('flux-lsp');
        }
    });

    test('all diagnostics have valid range', () => {
        const diags = provideDiagnostics('FOOBAR');
        for (const d of diags) {
            expect(d.range.start.line).toBeGreaterThanOrEqual(0);
            expect(d.range.end.line).toBeGreaterThanOrEqual(d.range.start.line);
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Mixed valid/invalid code
// ═══════════════════════════════════════════════════════════════════════════════

describe('provideDiagnostics — mixed code', () => {
    test('reports errors only for invalid lines', () => {
        const source = [
            'NOP',
            'FOOBAR',
            'ADD R1, R2, R3',
            'BAZQUX R1',
        ].join('\n');
        const diags = provideDiagnostics(source);
        expect(diags.length).toBeGreaterThanOrEqual(2);
        expect(diags[0].message).toContain('FOOBAR');
    });

    test('valid section headings produce no diagnostics', () => {
        const source = '## fn: my_func\n  NOP\n  HALT';
        const diags = provideDiagnostics(source);
        expect(diags).toHaveLength(0);
    });

    test('valid directives produce no diagnostics', () => {
        const source = '.text\n.global main\nNOP';
        const diags = provideDiagnostics(source);
        expect(diags).toHaveLength(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Edge cases
// ═══════════════════════════════════════════════════════════════════════════════

describe('provideDiagnostics — edge cases', () => {
    test('no crash on source with only whitespace', () => {
        const diags = provideDiagnostics('   \n   \n');
        expect(diags).toHaveLength(0);
    });

    test('handles label with opcode on same line', () => {
        const source = '@start: NOP';
        const diags = provideDiagnostics(source);
        expect(diags).toHaveLength(0);
    });

    test('handles SYS with string literal operand', () => {
        const diags = provideDiagnostics('SYS "hello"');
        expect(diags).toHaveLength(0);
    });

    test('handles hex immediates', () => {
        const diags = provideDiagnostics('MOVI R1, 0xFF');
        expect(diags).toHaveLength(0);
    });

    test('handles binary immediates', () => {
        const diags = provideDiagnostics('MOVI R1, 0b1010');
        expect(diags).toHaveLength(0);
    });
});
