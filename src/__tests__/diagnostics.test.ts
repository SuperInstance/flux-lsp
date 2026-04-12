/**
 * FLUX LSP Test Suite — Diagnostics Tests
 *
 * Tests the diagnostic engine for correct error detection:
 * unknown mnemonics, invalid registers, undefined labels,
 * wrong operand counts, duplicate labels, unused labels, immediate ranges.
 */

import { provideDiagnostics, makeDiagnostic, rangeForLine, parseImmediate } from '../diagnostics';
import { DiagnosticSeverity } from 'vscode-languageserver';

describe('Diagnostics — provideDiagnostics', () => {
    test('returns empty array for empty source', () => {
        expect(provideDiagnostics('')).toEqual([]);
    });

    test('returns empty for valid assembly', () => {
        const source = [
            '@start:',
            '  MOVI R0, 5',
            '  MOVI R1, 1',
            '@loop:',
            '  MUL R1, R1, R0',
            '  DEC R0',
            '  JNZ R0, @loop',
            '  HALT',
        ].join('\n');

        const diags = provideDiagnostics(source);
        expect(diags).toEqual([]);
    });

    test('detects unknown mnemonic', () => {
        const source = '  INVALIDOP R0, R1';
        const diags = provideDiagnostics(source);
        expect(diags.length).toBeGreaterThanOrEqual(1);
        expect(diags.some(d => d.message.includes('Unknown mnemonic'))).toBe(true);
    });

    test('detects undefined label reference', () => {
        const source = '  JMP @nonexistent';
        const diags = provideDiagnostics(source);
        expect(diags.some(d => d.code === 'flux-undefined-label')).toBe(true);
    });

    test('detects register out of range (R16+)', () => {
        const source = '  MOVI R16, 42';
        const diags = provideDiagnostics(source);
        // R16 is not a valid register (0-15), so we get invalid-register error
        expect(diags.some(d => d.code === 'flux-invalid-register')).toBe(true);
    });

    test('detects duplicate labels', () => {
        const source = [
            '@loop:',
            '  NOP',
            '@loop:',
            '  NOP',
        ].join('\n');

        const diags = provideDiagnostics(source);
        const dupes = diags.filter(d => d.code === 'flux-duplicate-label');
        expect(dupes.length).toBe(2); // one for each definition
    });

    test('detects unused labels', () => {
        const source = [
            '@unused_label:',
            '  NOP',
            '@used_label:',
            '  NOP',
            '  JMP @used_label',
        ].join('\n');

        const diags = provideDiagnostics(source);
        const unused = diags.filter(d => d.code === 'flux-unused-label');
        expect(unused.length).toBe(1);
        expect(unused[0].message).toContain('unused_label');
    });

    test('does not warn about unused @start label', () => {
        const source = '@start:\n  HALT';
        const diags = provideDiagnostics(source);
        expect(diags.some(d => d.code === 'flux-unused-label')).toBe(false);
    });

    test('does not warn about unused @main label', () => {
        const source = '@main:\n  HALT';
        const diags = provideDiagnostics(source);
        expect(diags.some(d => d.code === 'flux-unused-label')).toBe(false);
    });

    test('does not warn about unused @_start label', () => {
        const source = '@_start:\n  HALT';
        const diags = provideDiagnostics(source);
        expect(diags.some(d => d.code === 'flux-unused-label')).toBe(false);
    });

    test('detects immediate value out of range for imm8', () => {
        const source = '  MOVI R0, 300'; // imm8 range: -128 to 255
        const diags = provideDiagnostics(source);
        expect(diags.some(d => d.code === 'flux-immediate-range')).toBe(true);
        expect(diags.some(d => d.severity === DiagnosticSeverity.Warning)).toBe(true);
    });

    test('detects immediate value out of range for imm16', () => {
        const source = '  MOVI16 R0, 100000'; // imm16 range: -32768 to 65535
        const diags = provideDiagnostics(source);
        expect(diags.some(d => d.code === 'flux-immediate-range')).toBe(true);
    });

    test('accepts valid imm8 values', () => {
        const source = [
            '  MOVI R0, 0',
            '  MOVI R1, 127',
            '  MOVI R2, -128',
            '  MOVI R3, 255',
        ].join('\n');
        const diags = provideDiagnostics(source);
        expect(diags.some(d => d.code === 'flux-immediate-range')).toBe(false);
    });

    test('accepts valid imm16 values', () => {
        const source = [
            '  MOVI16 R0, 0',
            '  MOVI16 R1, 32767',
            '  MOVI16 R2, -32768',
            '  MOVI16 R3, 65535',
        ].join('\n');
        const diags = provideDiagnostics(source);
        expect(diags.some(d => d.code === 'flux-immediate-range')).toBe(false);
    });
});

describe('Diagnostics — multiple errors', () => {
    test('reports all errors in complex invalid source', () => {
        const source = [
            '@start:',
            '  INVALIDOP R0',
            '  MOVI R0, 9999',
            '  JMP @missing',
            '@start:',
            '  HALT',
            '@never_used:',
            '  NOP',
        ].join('\n');

        const diags = provideDiagnostics(source);
        expect(diags.some(d => d.code === 'flux-unknown-mnemonic')).toBe(true);
        expect(diags.some(d => d.code === 'flux-immediate-range')).toBe(true);
        expect(diags.some(d => d.code === 'flux-undefined-label')).toBe(true);
        expect(diags.some(d => d.code === 'flux-duplicate-label')).toBe(true);
        expect(diags.some(d => d.code === 'flux-unused-label')).toBe(true);
    });
});

describe('Diagnostics — helpers', () => {
    test('makeDiagnostic creates proper diagnostic', () => {
        const diag = makeDiagnostic(
            { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
            'test error',
            DiagnosticSeverity.Error,
            'test-code',
        );
        expect(diag.message).toBe('test error');
        expect(diag.severity).toBe(DiagnosticSeverity.Error);
        expect(diag.code).toBe('test-code');
        expect(diag.source).toBe('flux-lsp');
    });

    test('rangeForLine creates proper range', () => {
        const range = rangeForLine(5);
        expect(range.start.line).toBe(5);
        expect(range.start.character).toBe(0);
        expect(range.end.line).toBe(5);
        expect(range.end.character).toBe(999);
    });
});

describe('Diagnostics — parseImmediate', () => {
    test('parses decimal', () => {
        expect(parseImmediate('42')).toBe(42);
        expect(parseImmediate('-10')).toBe(-10);
        expect(parseImmediate('0')).toBe(0);
    });

    test('parses hex', () => {
        expect(parseImmediate('0xFF')).toBe(255);
        expect(parseImmediate('0x0')).toBe(0);
        expect(parseImmediate('0X1A')).toBe(26);
    });

    test('parses binary', () => {
        expect(parseImmediate('0b1010')).toBe(10);
        expect(parseImmediate('0B11110000')).toBe(240);
    });
});
