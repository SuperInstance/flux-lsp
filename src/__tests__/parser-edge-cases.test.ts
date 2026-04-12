/**
 * Additional edge-case tests for the FLUX Assembly Parser
 */

import {
    parseFluxAssembly,
    extractLabels,
    extractLabelInfos,
    extractLabelReferences,
    extractSections,
    validateOperandCount,
    isRegister,
    isImmediate,
    isLabelRef,
    ParsedLine,
} from '../parser';

// ─── parseFluxAssembly: additional edge cases ───────────────────────────────

describe('parseFluxAssembly - edge cases', () => {
    test('parses tab-indented opcode', () => {
        const lines = parseFluxAssembly('\tMOVI R0, 42');
        expect(lines[0].type).toBe('opcode');
        expect(lines[0].mnemonic).toBe('MOVI');
    });

    test('parses mixed whitespace', () => {
        const lines = parseFluxAssembly('   \t  ADD R0, R1, R2');
        expect(lines[0].type).toBe('opcode');
        expect(lines[0].mnemonic).toBe('ADD');
    });

    test('parses opcode with many spaces between operands', () => {
        const lines = parseFluxAssembly('ADD   R0,   R1,   R2');
        expect(lines[0].type).toBe('opcode');
        expect(lines[0].operands).toEqual(['R0', 'R1', 'R2']);
    });

    test('handles label with underscores and numbers', () => {
        const lines = parseFluxAssembly('@loop_counter_42:');
        expect(lines[0].type).toBe('label');
        expect(lines[0].label).toBe('loop_counter_42');
    });

    test('handles label starting with underscore', () => {
        const lines = parseFluxAssembly('@_private:');
        expect(lines[0].type).toBe('label');
        expect(lines[0].label).toBe('_private');
    });

    test('parses label+opcode with trailing comment', () => {
        const lines = parseFluxAssembly('@start: MOVI R0, 1 ; initialize');
        expect(lines[0].type).toBe('opcode');
        expect(lines[0].label).toBe('start');
        expect(lines[0].mnemonic).toBe('MOVI');
        expect(lines[0].comment).toBe('initialize');
    });

    test('parses bare semicolon comment (no text)', () => {
        const lines = parseFluxAssembly(';');
        expect(lines[0].type).toBe('comment');
        expect(lines[0].comment).toBe('');
    });

    test('handles multiple consecutive empty lines', () => {
        const lines = parseFluxAssembly('\n\n\n');
        // 'a\n\n\n' splits to ['a', '', '', ''] = 4 elements
        expect(lines).toHaveLength(4);
        expect(lines.every(l => l.type === 'empty')).toBe(true);
    });

    test('parses .global directive', () => {
        const lines = parseFluxAssembly('.global main');
        expect(lines[0].type).toBe('directive');
        expect(lines[0].directive).toBe('.global');
        expect(lines[0].operands).toEqual(['main']);
    });

    test('parses .align directive', () => {
        const lines = parseFluxAssembly('.align 4');
        expect(lines[0].type).toBe('directive');
        expect(lines[0].directive).toBe('.align');
    });

    test('parses .asciz directive with string', () => {
        const lines = parseFluxAssembly('.asciz "hello world"');
        expect(lines[0].type).toBe('directive');
        expect(lines[0].operands).toEqual(['"hello world"']);
    });

    test('preserves original line text', () => {
        const source = '  ADD R0, R1, R2  ';
        const lines = parseFluxAssembly(source);
        expect(lines[0].lineText).toBe(source);
    });

    test('sets correct mnemonicRange', () => {
        const lines = parseFluxAssembly('  ADD R0, R1, R2');
        expect(lines[0].mnemonicRange).toBeDefined();
        expect(lines[0].mnemonicRange!.start.line).toBe(0);
        expect(lines[0].mnemonicRange!.start.character).toBe(2); // after 2 spaces
    });

    test('sets correct mnemonicRange for label+opcode', () => {
        const lines = parseFluxAssembly('@start: MOVI R0, 42');
        expect(lines[0].mnemonicRange).toBeDefined();
        // MNEMONIC starts after '@start: '
        expect(lines[0].mnemonicRange!.start.character).toBe(8);
    });

    test('unknown token falls back to empty', () => {
        const lines = parseFluxAssembly('??? something weird');
        expect(lines[0].type).toBe('empty');
    });

    test('hash comment does not match #!directive', () => {
        const lines1 = parseFluxAssembly('# regular comment');
        const lines2 = parseFluxAssembly('#!capability math');
        expect(lines1[0].type).toBe('comment');
        expect(lines2[0].type).toBe('directive_comment');
    });

    test('parses opcode with lowercase (treated as empty/fallback)', () => {
        // OPCODE_RE requires uppercase starting letter
        const lines = parseFluxAssembly('add r0, r1, r2');
        // Lowercase "add" doesn't match OPCODE_RE (starts with [A-Z])
        expect(lines[0].type).toBe('empty');
    });

    test('handles C-style opcode with single digit', () => {
        // e.g., a valid mnemonic like "WFI" or "SYS"
        const lines = parseFluxAssembly('SYS 42');
        expect(lines[0].type).toBe('opcode');
        expect(lines[0].mnemonic).toBe('SYS');
    });

    test('section with complex signature', () => {
        const lines = parseFluxAssembly('## fn: process(data: *u8, len: i32) -> Result<i32, Error>');
        expect(lines[0].type).toBe('section');
        expect(lines[0].directive).toBe('fn');
        expect(lines[0].label).toContain('process');
    });
});

// ─── extractLabels: additional cases ────────────────────────────────────────

describe('extractLabels - additional cases', () => {
    test('later definition overrides earlier one', () => {
        const lines = parseFluxAssembly('@dup: HALT\n@dup: NOP');
        const labels = extractLabels(lines);
        // Map takes the last value for duplicate keys
        expect(labels.size).toBe(1);
        expect(labels.get('dup')).toBe(1);
    });

    test('labels from both standalone and opcode lines', () => {
        const lines = parseFluxAssembly('@a: HALT\n@b:\n  @c: NOP');
        const labels = extractLabels(lines);
        expect(labels.size).toBe(3);
        expect(labels.has('a')).toBe(true);
        expect(labels.has('b')).toBe(true);
        expect(labels.has('c')).toBe(true);
    });
});

// ─── extractLabelReferences: additional cases ───────────────────────────────

describe('extractLabelReferences - additional cases', () => {
    test('finds references in complex instructions', () => {
        const lines = parseFluxAssembly('JAL LR, @func\n  STORE @buf, R0, 1');
        const refs = extractLabelReferences(lines);
        const names = refs.map(r => r.name);
        expect(names).toContain('func');
        expect(names).toContain('buf');
    });

    test('does not match @ in comments', () => {
        const lines = parseFluxAssembly('; refer to @not_a_ref\n  ADD R0, R1, R2');
        const refs = extractLabelReferences(lines);
        expect(refs).toHaveLength(0);
    });

    test('tracks column position', () => {
        const lines = parseFluxAssembly('  JMP @target');
        const refs = extractLabelReferences(lines);
        expect(refs[0].col).toBeGreaterThan(0);
    });
});

// ─── extractSections: additional cases ──────────────────────────────────────

describe('extractSections - additional cases', () => {
    test('all 6 section types', () => {
        const types = ['fn', 'agent', 'tile', 'region', 'vocabulary', 'test'];
        for (const type of types) {
            const lines = parseFluxAssembly(`## ${type}: my_${type}`);
            const sections = extractSections(lines);
            expect(sections).toHaveLength(1);
            expect(sections[0].type).toBe(type);
            expect(sections[0].name).toBe(`my_${type}`);
        }
    });

    test('section position is correct', () => {
        const lines = parseFluxAssembly('HALT\n## fn: test\nHALT');
        const sections = extractSections(lines);
        expect(sections[0].line).toBe(1);
        expect(sections[0].position).toEqual({ line: 1, character: 0 });
    });

    test('section signature includes name', () => {
        const lines = parseFluxAssembly('## fn: factorial(n: i32) -> i32');
        const sections = extractSections(lines);
        expect(sections[0].signature).toContain('factorial');
    });
});

// ─── isRegister: additional cases ───────────────────────────────────────────

describe('isRegister - additional cases', () => {
    test('case-sensitive: lowercase rejected', () => {
        expect(isRegister('r0')).toBe(false);
        expect(isRegister('f0')).toBe(false);
        expect(isRegister('sp')).toBe(false);
    });

    test('boundary: R0 and R15 valid', () => {
        expect(isRegister('R0')).toBe(true);
        expect(isRegister('R15')).toBe(true);
    });

    test('single-char not a register', () => {
        expect(isRegister('R')).toBe(false);
        expect(isRegister('F')).toBe(false);
    });

    test('empty string not a register', () => {
        expect(isRegister('')).toBe(false);
    });

    test('V0-V15 valid', () => {
        for (let i = 0; i <= 15; i++) {
            expect(isRegister(`V${i}`)).toBe(true);
        }
        expect(isRegister('V16')).toBe(false);
    });
});

// ─── isImmediate: additional cases ──────────────────────────────────────────

describe('isImmediate - additional cases', () => {
    test('large hex value', () => {
        expect(isImmediate('0xFFFFFFFF')).toBe(true);
    });

    test('zero in various formats', () => {
        expect(isImmediate('0')).toBe(true);
        expect(isImmediate('0x0')).toBe(true);
        expect(isImmediate('0b0')).toBe(true);
    });

    test('positive sign accepted', () => {
        expect(isImmediate('+42')).toBe(true);
    });

    test('floating point not an immediate', () => {
        expect(isImmediate('3.14')).toBe(false);
    });

    test('whitespace not an immediate', () => {
        expect(isImmediate(' ')).toBe(false);
    });
});

// ─── validateOperandCount: additional cases ────────────────────────────────

describe('validateOperandCount - additional cases', () => {
    test('MOV accepts 2 operands (rd, rs1, - is optional)', () => {
        // MOV has 3 operands but last is unused, so 2 is valid
        expect(validateOperandCount('MOV', 2)).toBeNull();
    });

    test('JZ accepts 2 operands (rd, rs1, - is optional)', () => {
        expect(validateOperandCount('JZ', 2)).toBeNull();
    });

    test('STORE with wrong count', () => {
        const result = validateOperandCount('STORE', 1);
        expect(result).not.toBeNull();
        expect(result).toContain('STORE');
    });

    test('DIV with 3 operands is correct', () => {
        expect(validateOperandCount('DIV', 3)).toBeNull();
    });

    test('LOADOFF with 3 operands is correct', () => {
        expect(validateOperandCount('LOADOFF', 3)).toBeNull();
    });

    test('C_THRESH (imm8 format) with 2 operands', () => {
        expect(validateOperandCount('C_THRESH', 2)).toBeNull();
    });
});
