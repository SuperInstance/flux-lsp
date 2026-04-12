/**
 * Tests for the FLUX Assembly Parser
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

// ─── parseFluxAssembly ──────────────────────────────────────────────────────

describe('parseFluxAssembly', () => {
    test('parses empty input', () => {
        const lines = parseFluxAssembly('');
        expect(lines).toHaveLength(1);
        expect(lines[0].type).toBe('empty');
    });

    test('parses a simple opcode line', () => {
        const lines = parseFluxAssembly('ADD R0, R1, R2');
        expect(lines).toHaveLength(1);
        expect(lines[0].type).toBe('opcode');
        expect(lines[0].mnemonic).toBe('ADD');
        expect(lines[0].operands).toEqual(['R0', 'R1', 'R2']);
    });

    test('parses a zero-operand opcode', () => {
        const lines = parseFluxAssembly('HALT');
        expect(lines[0].type).toBe('opcode');
        expect(lines[0].mnemonic).toBe('HALT');
        expect(lines[0].operands).toEqual([]);
    });

    test('parses a single-register opcode', () => {
        const lines = parseFluxAssembly('INC R0');
        expect(lines[0].type).toBe('opcode');
        expect(lines[0].mnemonic).toBe('INC');
        expect(lines[0].operands).toEqual(['R0']);
    });

    test('parses label definition', () => {
        const lines = parseFluxAssembly('@loop:');
        expect(lines[0].type).toBe('label');
        expect(lines[0].label).toBe('loop');
    });

    test('parses label with opcode on same line', () => {
        const lines = parseFluxAssembly('@start: MOVI R0, 42');
        expect(lines[0].type).toBe('opcode');
        expect(lines[0].label).toBe('start');
        expect(lines[0].mnemonic).toBe('MOVI');
        expect(lines[0].operands).toEqual(['R0', '42']);
    });

    test('parses semicolon comment', () => {
        const lines = parseFluxAssembly('; this is a comment');
        expect(lines[0].type).toBe('comment');
        expect(lines[0].comment).toBe('this is a comment');
    });

    test('parses hash comment', () => {
        const lines = parseFluxAssembly('# this is a comment');
        expect(lines[0].type).toBe('comment');
    });

    test('does not parse #! as a regular comment', () => {
        const lines = parseFluxAssembly('#!capability arithmetic');
        expect(lines[0].type).toBe('directive_comment');
        expect(lines[0].directive).toBe('#!capability');
        expect(lines[0].label).toBe('arithmetic');
    });

    test('parses directive', () => {
        const lines = parseFluxAssembly('.text');
        expect(lines[0].type).toBe('directive');
        expect(lines[0].directive).toBe('.text');
    });

    test('parses directive with operands', () => {
        const lines = parseFluxAssembly('.word 0x42, 0xFF');
        expect(lines[0].type).toBe('directive');
        expect(lines[0].directive).toBe('.word');
        expect(lines[0].operands).toEqual(['0x42', '0xFF']);
    });

    test('parses section heading', () => {
        const lines = parseFluxAssembly('## fn: factorial(n: i32) -> i32');
        expect(lines[0].type).toBe('section');
        expect(lines[0].directive).toBe('fn');
        expect(lines[0].label).toContain('factorial');
    });

    test('parses multiple section types', () => {
        const types = ['fn', 'agent', 'tile', 'region', 'vocabulary', 'test'];
        for (const type of types) {
            const lines = parseFluxAssembly(`## ${type}: my_${type}`);
            expect(lines[0].type).toBe('section');
            expect(lines[0].directive).toBe(type);
        }
    });

    test('handles inline comments on opcode lines', () => {
        const lines = parseFluxAssembly('ADD R0, R1, R2 ; add them up');
        expect(lines[0].type).toBe('opcode');
        expect(lines[0].mnemonic).toBe('ADD');
        expect(lines[0].comment).toBe('add them up');
    });

    test('handles leading whitespace', () => {
        const lines = parseFluxAssembly('  MOVI R0, 42');
        expect(lines[0].type).toBe('opcode');
        expect(lines[0].mnemonic).toBe('MOVI');
    });

    test('preserves line numbers', () => {
        const source = 'HALT\nADD R0, R1, R2\n@loop:\n  JMP @loop';
        const lines = parseFluxAssembly(source);
        expect(lines).toHaveLength(4);
        expect(lines[0].lineNumber).toBe(0);
        expect(lines[1].lineNumber).toBe(1);
        expect(lines[2].lineNumber).toBe(2);
        expect(lines[3].lineNumber).toBe(3);
    });

    test('handles string operands with commas', () => {
        const lines = parseFluxAssembly('SYS "hello, world"');
        expect(lines[0].operands).toEqual(['"hello, world"']);
    });

    test('handles operands with parentheses', () => {
        const lines = parseFluxAssembly('CALL func(arg1, arg2)');
        expect(lines[0].operands).toEqual(['func(arg1, arg2)']);
    });
});

// ─── extractLabels ──────────────────────────────────────────────────────────

describe('extractLabels', () => {
    test('extracts standalone labels', () => {
        const lines = parseFluxAssembly('@start:\n@loop:\n@exit:');
        const labels = extractLabels(lines);
        expect(labels.size).toBe(3);
        expect(labels.get('start')).toBe(0);
        expect(labels.get('loop')).toBe(1);
        expect(labels.get('exit')).toBe(2);
    });

    test('extracts labels defined with opcodes', () => {
        const lines = parseFluxAssembly('@done: HALT\n@entry: MOVI R0, 1');
        const labels = extractLabels(lines);
        expect(labels.size).toBe(2);
        expect(labels.get('done')).toBe(0);
        expect(labels.get('entry')).toBe(1);
    });

    test('does not extract section names as labels', () => {
        const lines = parseFluxAssembly('## fn: test\n@start:');
        const labels = extractLabels(lines);
        expect(labels.size).toBe(1);
        expect(labels.has('start')).toBe(true);
    });
});

// ─── extractLabelInfos ──────────────────────────────────────────────────────

describe('extractLabelInfos', () => {
    test('returns label info with positions', () => {
        const lines = parseFluxAssembly('@begin:\n  MOVI R0, 1\n@end: HALT');
        const infos = extractLabelInfos(lines);
        expect(infos).toHaveLength(2);
        expect(infos[0].name).toBe('begin');
        expect(infos[0].line).toBe(0);
        expect(infos[0].position).toEqual({ line: 0, character: 0 });
        expect(infos[1].name).toBe('end');
        expect(infos[1].line).toBe(2);
    });
});

// ─── extractLabelReferences ─────────────────────────────────────────────────

describe('extractLabelReferences', () => {
    test('finds label references in operands', () => {
        const lines = parseFluxAssembly('JMP @loop\n  JNZ R0, @exit');
        const refs = extractLabelReferences(lines);
        expect(refs).toHaveLength(2);
        expect(refs[0].name).toBe('loop');
        expect(refs[1].name).toBe('exit');
    });

    test('does not include label definitions as references', () => {
        const lines = parseFluxAssembly('@loop:\n  JMP @loop');
        const refs = extractLabelReferences(lines);
        // Only the JMP operand should be a reference, not the @loop: definition
        expect(refs).toHaveLength(1);
        expect(refs[0].name).toBe('loop');
    });
});

// ─── extractSections ────────────────────────────────────────────────────────

describe('extractSections', () => {
    test('extracts section definitions', () => {
        const source = '## fn: test\n## agent: calc';
        const lines = parseFluxAssembly(source);
        const sections = extractSections(lines);
        expect(sections).toHaveLength(2);
        expect(sections[0].type).toBe('fn');
        expect(sections[0].name).toBe('test');
        expect(sections[1].type).toBe('agent');
        expect(sections[1].name).toBe('calc');
    });
});

// ─── isRegister ─────────────────────────────────────────────────────────────

describe('isRegister', () => {
    test('valid GP registers', () => {
        expect(isRegister('R0')).toBe(true);
        expect(isRegister('R7')).toBe(true);
        expect(isRegister('R15')).toBe(true);
    });

    test('invalid GP registers', () => {
        expect(isRegister('R16')).toBe(false);
        expect(isRegister('R20')).toBe(false);
    });

    test('valid FP registers', () => {
        expect(isRegister('F0')).toBe(true);
        expect(isRegister('F15')).toBe(true);
    });

    test('invalid FP registers', () => {
        expect(isRegister('F16')).toBe(false);
    });

    test('valid vector registers', () => {
        expect(isRegister('V0')).toBe(true);
        expect(isRegister('V15')).toBe(true);
    });

    test('invalid vector registers', () => {
        expect(isRegister('V16')).toBe(false);
    });

    test('special registers', () => {
        expect(isRegister('SP')).toBe(true);
        expect(isRegister('FP')).toBe(true);
        expect(isRegister('LR')).toBe(true);
        expect(isRegister('PC')).toBe(true);
        expect(isRegister('FLAGS')).toBe(true);
    });

    test('invalid registers', () => {
        expect(isRegister('X0')).toBe(false);
        expect(isRegister('R-1')).toBe(false);
        expect(isRegister('')).toBe(false);
    });
});

// ─── isImmediate ────────────────────────────────────────────────────────────

describe('isImmediate', () => {
    test('decimal', () => {
        expect(isImmediate('42')).toBe(true);
        expect(isImmediate('0')).toBe(true);
        expect(isImmediate('255')).toBe(true);
    });

    test('negative decimal', () => {
        expect(isImmediate('-1')).toBe(true);
        expect(isImmediate('-128')).toBe(true);
    });

    test('hexadecimal', () => {
        expect(isImmediate('0xFF')).toBe(true);
        expect(isImmediate('0x00')).toBe(true);
        expect(isImmediate('0X1A')).toBe(true);
    });

    test('binary', () => {
        expect(isImmediate('0b1010')).toBe(true);
        expect(isImmediate('0B11110000')).toBe(true);
    });

    test('invalid', () => {
        expect(isImmediate('R0')).toBe(false);
        expect(isImmediate('@loop')).toBe(false);
        expect(isImmediate('abc')).toBe(false);
        expect(isImmediate('')).toBe(false);
    });
});

// ─── isLabelRef ─────────────────────────────────────────────────────────────

describe('isLabelRef', () => {
    test('valid label references', () => {
        expect(isLabelRef('@loop')).toBe(true);
        expect(isLabelRef('@start')).toBe(true);
        expect(isLabelRef('@exit_condition')).toBe(true);
    });

    test('invalid', () => {
        expect(isLabelRef('loop')).toBe(false);
        expect(isLabelRef('@')).toBe(false);
        expect(isLabelRef('')).toBe(false);
        // Note: @123 matches \\w+ so is a valid label ref format
    });
});

// ─── validateOperandCount ───────────────────────────────────────────────────

describe('validateOperandCount', () => {
    test('returns null for valid operand count', () => {
        expect(validateOperandCount('ADD', 3)).toBeNull();
        expect(validateOperandCount('HALT', 0)).toBeNull();
        expect(validateOperandCount('INC', 1)).toBeNull();
        expect(validateOperandCount('MOVI', 2)).toBeNull();
    });

    test('returns error for wrong operand count', () => {
        const result = validateOperandCount('ADD', 2);
        expect(result).not.toBeNull();
        expect(result).toContain('ADD');
    });

    test('returns null for unknown mnemonic', () => {
        expect(validateOperandCount('FAKEOP', 3)).toBeNull();
    });
});
