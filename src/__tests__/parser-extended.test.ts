/**
 * FLUX LSP Test Suite — Extended Parser Tests
 *
 * Additional parser edge cases: operand splitting, label patterns,
 * directive variations, comment edge cases, section types.
 */

import {
    parseFluxAssembly,
    extractLabels,
    extractLabelInfos,
    extractLabelReferences,
    extractSections,
    isRegister,
    isImmediate,
    isLabelRef,
    validateOperandCount,
} from '../parser';

describe('Parser Extended — Operand Splitting', () => {
    test('splits simple comma-separated operands', () => {
        const lines = parseFluxAssembly('ADD R1, R2, R3');
        expect(lines[0].operands).toEqual(['R1', 'R2', 'R3']);
    });

    test('handles extra whitespace around operands', () => {
        const lines = parseFluxAssembly('ADD  R1  ,  R2  ,  R3  ');
        expect(lines[0].operands).toEqual(['R1', 'R2', 'R3']);
    });

    test('handles single operand', () => {
        const lines = parseFluxAssembly('INC R0');
        expect(lines[0].operands).toEqual(['R0']);
    });

    test('handles zero operands', () => {
        const lines = parseFluxAssembly('HALT');
        expect(lines[0].operands).toEqual([]);
    });

    test('handles immediate values as operands', () => {
        const lines = parseFluxAssembly('MOVI R0, 42');
        expect(lines[0].operands).toEqual(['R0', '42']);
    });

    test('handles hex immediate as operand', () => {
        const lines = parseFluxAssembly('MOVI R0, 0xFF');
        expect(lines[0].operands).toEqual(['R0', '0xFF']);
    });

    test('handles binary immediate as operand', () => {
        const lines = parseFluxAssembly('MOVI R0, 0b10101010');
        expect(lines[0].operands).toEqual(['R0', '0b10101010']);
    });

    test('handles negative immediate as operand', () => {
        const lines = parseFluxAssembly('ADDI R0, -10');
        expect(lines[0].operands).toEqual(['R0', '-10']);
    });

    test('handles label references as operands', () => {
        const lines = parseFluxAssembly('JNZ R0, @loop');
        expect(lines[0].operands).toEqual(['R0', '@loop']);
    });

    test('parses directives with multiple operands', () => {
        const lines = parseFluxAssembly('.byte 0x41, 0x42, 0x43');
        expect(lines[0].operands).toEqual(['0x41', '0x42', '0x43']);
    });

    test('handles empty comment after semicolon', () => {
        const lines = parseFluxAssembly('ADD R0, R1, R2  ;');
        expect(lines[0].type).toBe('opcode');
        expect(lines[0].comment).toBeUndefined();
    });

    test('handles comment with special characters', () => {
        const lines = parseFluxAssembly('; this is a test: with = special <> chars');
        expect(lines[0].type).toBe('comment');
        expect(lines[0].comment).toBe('this is a test: with = special <> chars');
    });
});

describe('Parser Extended — Label Patterns', () => {
    test('label with underscores', () => {
        const lines = parseFluxAssembly('@my_label:');
        expect(lines[0].label).toBe('my_label');
    });

    test('label with numbers', () => {
        const lines = parseFluxAssembly('@label123:');
        expect(lines[0].label).toBe('label123');
    });

    test('label starting with underscore', () => {
        const lines = parseFluxAssembly('@_start:');
        expect(lines[0].label).toBe('_start');
    });

    test('label with opcode on same line preserves both', () => {
        const lines = parseFluxAssembly('@entry: MOVI R0, 0  ; init');
        expect(lines[0].label).toBe('entry');
        expect(lines[0].mnemonic).toBe('MOVI');
        expect(lines[0].operands).toEqual(['R0', '0']);
        expect(lines[0].comment).toBe('init');
    });

    test('extractLabelInfos returns correct positions', () => {
        const source = '@alpha:\nHALT\n@beta:\nNOP';
        const lines = parseFluxAssembly(source);
        const infos = extractLabelInfos(lines);
        expect(infos).toHaveLength(2);
        expect(infos[0].name).toBe('alpha');
        expect(infos[0].line).toBe(0);
        expect(infos[1].name).toBe('beta');
        expect(infos[1].line).toBe(2);
    });

    test('extractLabelReferences tracks column positions', () => {
        const source = '  JMP @loop';
        const lines = parseFluxAssembly(source);
        const refs = extractLabelReferences(lines);
        expect(refs).toHaveLength(1);
        expect(refs[0].name).toBe('loop');
        expect(refs[0].col).toBeGreaterThanOrEqual(0);
    });
});

describe('Parser Extended — Section Types', () => {
    test('parses all section types', () => {
        const source = [
            '## fn: main',
            '## agent: worker',
            '## tile: gpu',
            '## region: shared',
            '## vocabulary: words',
            '## test: smoke_test',
        ].join('\n');
        const sections = extractSections(parseFluxAssembly(source));
        expect(sections).toHaveLength(6);
        expect(sections.map(s => s.type)).toEqual(['fn', 'agent', 'tile', 'region', 'vocabulary', 'test']);
    });

    test('section position is correct', () => {
        const source = 'line0\n## fn: test\nline2';
        const sections = extractSections(parseFluxAssembly(source));
        expect(sections[0].line).toBe(1);
        expect(sections[0].position.line).toBe(1);
    });

    test('section with complex signature', () => {
        const source = '## fn: compute(a: i32, b: i32) -> i32';
        const sections = extractSections(parseFluxAssembly(source));
        expect(sections[0].name).toBe('compute(a: i32, b: i32) -> i32');
        expect(sections[0].signature).toBe('compute(a: i32, b: i32) -> i32');
    });
});

describe('Parser Extended — Directive Comment Patterns', () => {
    test('#!import directive', () => {
        const lines = parseFluxAssembly('#!import std.io');
        expect(lines[0].type).toBe('directive_comment');
        expect(lines[0].directive).toBe('#!import');
        expect(lines[0].label).toBe('std.io');
    });

    test('#!export directive', () => {
        const lines = parseFluxAssembly('#!export main');
        expect(lines[0].type).toBe('directive_comment');
        expect(lines[0].directive).toBe('#!export');
    });

    test('#!capability with spaces', () => {
        const lines = parseFluxAssembly('#!capability network parallel');
        expect(lines[0].type).toBe('directive_comment');
        expect(lines[0].label).toBe('network parallel');
    });
});

describe('Parser Extended — Validation Helpers', () => {
    test('isRegister accepts all GP registers', () => {
        for (let i = 0; i <= 15; i++) {
            expect(isRegister(`R${i}`)).toBe(true);
        }
    });

    test('isRegister rejects lowercase', () => {
        expect(isRegister('r0')).toBe(false);
        expect(isRegister('sp')).toBe(false);
        expect(isRegister('flags')).toBe(false);
    });

    test('isImmediate rejects hex without prefix', () => {
        expect(isImmediate('FF')).toBe(false);
        expect(isImmediate('1010')).toBe(true); // decimal
    });

    test('isLabelRef rejects bare word', () => {
        expect(isLabelRef('loop')).toBe(false);
        expect(isLabelRef('LOOP')).toBe(false);
    });

    test('isLabelRef accepts underscore prefix', () => {
        expect(isLabelRef('@_internal')).toBe(true);
    });

    test('validateOperandCount for various opcodes', () => {
        expect(validateOperandCount('SUB', 3)).toBeNull();
        expect(validateOperandCount('MUL', 3)).toBeNull();
        expect(validateOperandCount('DIV', 3)).toBeNull();
        expect(validateOperandCount('LOAD', 3)).toBeNull();
        expect(validateOperandCount('STORE', 3)).toBeNull();
        expect(validateOperandCount('PUSH', 1)).toBeNull();
        expect(validateOperandCount('POP', 1)).toBeNull();
        expect(validateOperandCount('NOP', 0)).toBeNull();
        expect(validateOperandCount('BRK', 0)).toBeNull();
        expect(validateOperandCount('SYS', 1)).toBeNull();
        expect(validateOperandCount('MOVI16', 2)).toBeNull();
    });
});

describe('Parser Extended — Multi-line Programs', () => {
    test('fibonacci program parses completely', () => {
        const source = [
            '; Fibonacci sequence generator',
            '.global _start',
            '',
            '## fn: fib(n: i32) -> i32',
            '',
            '@_start:',
            '  MOVI R0, 10      ; n = 10',
            '  MOVI R1, 0       ; a = 0',
            '  MOVI R2, 1       ; b = 1',
            '@fib_loop:',
            '  ADD R3, R1, R2   ; temp = a + b',
            '  MOV R1, R2       ; a = b',
            '  MOV R2, R3       ; b = temp',
            '  DEC R0           ; n--',
            '  JNZ R0, @fib_loop',
            '',
            '@done:',
            '  HALT',
        ].join('\n');
        const lines = parseFluxAssembly(source);
        expect(lines.length).toBe(18);
        const labels = extractLabels(lines);
        expect(labels.has('_start')).toBe(true);
        expect(labels.has('fib_loop')).toBe(true);
        expect(labels.has('done')).toBe(true);
    });

    test('mixed comment styles in program', () => {
        const source = [
            '; semicolon comment',
            '# hash comment',
            '  HALT  ; inline comment',
            '',
            '## fn: test',
            '#!directive value',
        ].join('\n');
        const lines = parseFluxAssembly(source);
        expect(lines[0].type).toBe('comment');
        expect(lines[1].type).toBe('comment');
        expect(lines[2].type).toBe('opcode');
        expect(lines[2].comment).toBe('inline comment');
        expect(lines[4].type).toBe('section');
        expect(lines[5].type).toBe('directive_comment');
    });
});
