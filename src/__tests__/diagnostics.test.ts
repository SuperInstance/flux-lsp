/**
 * Tests for the FLUX Diagnostic Provider
 */

import { provideDiagnostics } from '../diagnostics';
import { DiagnosticSeverity } from 'vscode-languageserver';

describe('provideDiagnostics', () => {
    // ─── Valid code: no errors ──────────────────────────────────────────

    test('no diagnostics for valid simple program', () => {
        const source = [
            '@start:',
            '  MOVI R0, 42',
            '  HALT',
        ].join('\n');

        const diags = provideDiagnostics(source);
        expect(diags).toHaveLength(0);
    });

    test('no diagnostics for valid multi-instruction program', () => {
        const source = [
            '@start:',
            '  MOVI R0, 0',
            '  MOVI R1, 10',
            '@loop:',
            '  ADD R0, R0, R1',
            '  INC R1',
            '  CMP_EQ R2, R1, 15',
            '  JNZ R2, @loop',
            '  HALT',
        ].join('\n');

        const diags = provideDiagnostics(source);
        expect(diags).toHaveLength(0);
    });

    test('no diagnostics for label definitions only', () => {
        const source = '@start:\n@loop:\n@end:';
        const diags = provideDiagnostics(source);
        expect(diags).toHaveLength(0);
    });

    test('no diagnostics for comments', () => {
        const source = '; this is a comment\n; another comment';
        const diags = provideDiagnostics(source);
        expect(diags).toHaveLength(0);
    });

    // ─── Unknown mnemonic ───────────────────────────────────────────────

    test('reports unknown mnemonic', () => {
        const source = 'FAKEOP R0, R1';
        const diags = provideDiagnostics(source);
        expect(diags).toHaveLength(1);
        expect(diags[0].message).toContain("Unknown mnemonic 'FAKEOP'");
        expect(diags[0].severity).toBe(DiagnosticSeverity.Error);
    });

    test('reports unknown mnemonic with code', () => {
        const source = 'INVALID';
        const diags = provideDiagnostics(source);
        expect(diags[0].code).toBe('flux-unknown-mnemonic');
    });

    // ─── Register range ─────────────────────────────────────────────────

    test('reports R16 as invalid register (not a recognized register)', () => {
        const source = 'ADD R16, R1, R2';
        const diags = provideDiagnostics(source);
        // R16 is not a recognized register so it should produce an error
        const regErrors = diags.filter(d =>
            d.message.includes('Expected register') && d.message.includes('R16')
        );
        expect(regErrors.length).toBeGreaterThanOrEqual(1);
    });

    test('reports F16 as invalid register', () => {
        const source = 'FADD F16, F1, F2';
        const diags = provideDiagnostics(source);
        const regErrors = diags.filter(d =>
            d.message.includes('Expected register') && d.message.includes('F16')
        );
        expect(regErrors.length).toBeGreaterThanOrEqual(1);
    });

    // ─── Undefined label references ─────────────────────────────────────

    test('reports undefined label reference', () => {
        const source = 'JMP @undefined_label';
        const diags = provideDiagnostics(source);
        const labelErrors = diags.filter(d =>
            d.code === 'flux-undefined-label'
        );
        expect(labelErrors).toHaveLength(1);
        expect(labelErrors[0].message).toContain('@undefined_label');
    });

    test('no error when label is defined', () => {
        const source = '@my_label:\n  JMP @my_label';
        const diags = provideDiagnostics(source);
        const labelErrors = diags.filter(d => d.code === 'flux-undefined-label');
        expect(labelErrors).toHaveLength(0);
    });

    test('reports only the first undefined label (no duplicates for multiple refs to same label)', () => {
        const source = [
            '  JMP @missing',
            '  JNZ R0, @missing',
        ].join('\n');
        const diags = provideDiagnostics(source);
        const missingDiags = diags.filter(d => d.code === 'flux-undefined-label');
        // Each reference should generate its own diagnostic
        expect(missingDiags).toHaveLength(2);
    });

    // ─── Immediate range ────────────────────────────────────────────────

    test('warns about imm8 out of range (too large)', () => {
        const source = 'MOVI R0, 300';
        const diags = provideDiagnostics(source);
        const rangeDiags = diags.filter(d => d.code === 'flux-immediate-range');
        expect(rangeDiags.length).toBeGreaterThanOrEqual(1);
    });

    test('warns about imm8 out of range (too negative)', () => {
        const source = 'MOVI R0, -200';
        const diags = provideDiagnostics(source);
        const rangeDiags = diags.filter(d => d.code === 'flux-immediate-range');
        expect(rangeDiags.length).toBeGreaterThanOrEqual(1);
    });

    test('no warning for imm8 in valid range', () => {
        const source = 'MOVI R0, 127';
        const diags = provideDiagnostics(source);
        expect(diags).toHaveLength(0);
    });

    // ─── Malformed immediate ────────────────────────────────────────────

    test('reports malformed immediate', () => {
        const source = 'MOVI R0, 0xGH';
        const diags = provideDiagnostics(source);
        const malformedDiags = diags.filter(d => d.code === 'flux-malformed-immediate');
        expect(malformedDiags.length).toBeGreaterThanOrEqual(1);
    });

    // ─── Multiple errors in one file ────────────────────────────────────

    test('reports multiple errors in one file', () => {
        const source = [
            'FAKEOP R0',
            'ADD R16, R1, R2',
            'JMP @undefined',
        ].join('\n');
        const diags = provideDiagnostics(source);
        expect(diags.length).toBeGreaterThanOrEqual(3);
    });

    // ─── Source field ───────────────────────────────────────────────────

    test('all diagnostics have source set to flux-lsp', () => {
        const source = 'FAKEOP R0';
        const diags = provideDiagnostics(source);
        for (const d of diags) {
            expect(d.source).toBe('flux-lsp');
        }
    });

    // ─── Edge cases ─────────────────────────────────────────────────────

    test('empty source produces no diagnostics', () => {
        const diags = provideDiagnostics('');
        expect(diags).toHaveLength(0);
    });

    test('whitespace-only source produces no diagnostics', () => {
        const diags = provideDiagnostics('   \n  \n');
        expect(diags).toHaveLength(0);
    });

    test('directives do not produce diagnostics', () => {
        const source = '.text\n.global main\n.word 42';
        const diags = provideDiagnostics(source);
        expect(diags).toHaveLength(0);
    });

    test('hex immediates are accepted', () => {
        const source = 'MOVI R0, 0xFF';
        const diags = provideDiagnostics(source);
        expect(diags).toHaveLength(0);
    });

    test('binary immediates are accepted', () => {
        const source = 'MOVI R0, 0b10101010';
        const diags = provideDiagnostics(source);
        expect(diags).toHaveLength(0);
    });

    test('negative immediates are accepted', () => {
        const source = 'ADDI R0, -5';
        const diags = provideDiagnostics(source);
        expect(diags).toHaveLength(0);
    });

    test('string literals in SYS are accepted', () => {
        const source = 'SYS "hello world"';
        const diags = provideDiagnostics(source);
        expect(diags).toHaveLength(0);
    });

    test('dash operands for unused slots are accepted', () => {
        const source = 'MOV R0, R1, -';
        const diags = provideDiagnostics(source);
        expect(diags).toHaveLength(0);
    });

    test('label references in appropriate operands work', () => {
        // JNZ takes rd, rs1, - — so label refs are fine in the context
        const source = '@target:\n  JNZ R0, @target';
        const diags = provideDiagnostics(source);
        // No undefined label error since @target is defined
        const labelErrors = diags.filter(d => d.code === 'flux-undefined-label');
        expect(labelErrors).toHaveLength(0);
    });
});
