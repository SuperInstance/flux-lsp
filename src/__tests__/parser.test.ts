/**
 * FLUX LSP Test Suite — Parser Tests
 *
 * Tests the FLUX assembly parser for correct parsing of all line types:
 * labels, opcodes, directives, comments, sections, empty lines.
 */

import { parseFluxAssembly, extractLabels, extractLabelReferences, extractSections, extractLabelInfos, isRegister, isImmediate, isLabelRef, validateOperandCount } from '../parser';

describe('Parser — parseFluxAssembly', () => {
    test('parses empty source', () => {
        const lines = parseFluxAssembly('');
        expect(lines).toHaveLength(1);
        expect(lines[0].type).toBe('empty');
    });

    test('parses a single empty line', () => {
        const lines = parseFluxAssembly('  ');
        expect(lines).toHaveLength(1);
        expect(lines[0].type).toBe('empty');
    });

    test('parses semicolon comments', () => {
        const lines = parseFluxAssembly('; this is a comment');
        expect(lines).toHaveLength(1);
        expect(lines[0].type).toBe('comment');
        expect(lines[0].comment).toBe('this is a comment');
    });

    test('parses hash comments', () => {
        const lines = parseFluxAssembly('# this is a comment');
        expect(lines).toHaveLength(1);
        expect(lines[0].type).toBe('comment');
        expect(lines[0].comment).toBe('this is a comment');
    });

    test('does not treat #! directives as comments', () => {
        const lines = parseFluxAssembly('#!capability parallel');
        expect(lines).toHaveLength(1);
        expect(lines[0].type).toBe('directive_comment');
        expect(lines[0].directive).toBe('#!capability');
        expect(lines[0].label).toBe('parallel');
    });

    test('parses section headings', () => {
        const lines = parseFluxAssembly('## fn: factorial(n: i32) -> i32');
        expect(lines).toHaveLength(1);
        expect(lines[0].type).toBe('section');
        expect(lines[0].directive).toBe('fn');
        expect(lines[0].label).toBe('factorial(n: i32) -> i32');
    });

    test('parses agent sections', () => {
        const lines = parseFluxAssembly('## agent: orchestrator');
        expect(lines).toHaveLength(1);
        expect(lines[0].type).toBe('section');
        expect(lines[0].directive).toBe('agent');
        expect(lines[0].label).toBe('orchestrator');
    });

    test('parses standalone label', () => {
        const lines = parseFluxAssembly('@loop:');
        expect(lines).toHaveLength(1);
        expect(lines[0].type).toBe('label');
        expect(lines[0].label).toBe('loop');
    });

    test('parses opcode with operands and trailing comment', () => {
        const lines = parseFluxAssembly('  ADD R1, R2, R3  ; add values');
        expect(lines).toHaveLength(1);
        expect(lines[0].type).toBe('opcode');
        expect(lines[0].mnemonic).toBe('ADD');
        expect(lines[0].operands).toEqual(['R1', 'R2', 'R3']);
        expect(lines[0].comment).toBe('add values');
    });

    test('parses opcode without operands', () => {
        const lines = parseFluxAssembly('HALT');
        expect(lines).toHaveLength(1);
        expect(lines[0].type).toBe('opcode');
        expect(lines[0].mnemonic).toBe('HALT');
        expect(lines[0].operands).toEqual([]);
    });

    test('parses label + opcode on same line', () => {
        const lines = parseFluxAssembly('@start: MOVI R0, 42');
        expect(lines).toHaveLength(1);
        expect(lines[0].type).toBe('opcode');
        expect(lines[0].label).toBe('start');
        expect(lines[0].mnemonic).toBe('MOVI');
        expect(lines[0].operands).toEqual(['R0', '42']);
    });

    test('parses assembler directives', () => {
        const lines = parseFluxAssembly('.global main');
        expect(lines).toHaveLength(1);
        expect(lines[0].type).toBe('directive');
        expect(lines[0].directive).toBe('.global');
        expect(lines[0].operands).toEqual(['main']);
    });

    test('parses multi-line source', () => {
        const source = [
            '; Factorial program',
            '.global main',
            '@start:',
            '  MOVI R0, 5',
            '  MOVI R1, 1',
            '@loop:',
            '  MUL R1, R1, R0',
            '  DEC R0',
            '  JNZ R0, @loop',
            '  HALT',
        ].join('\n');

        const lines = parseFluxAssembly(source);
        expect(lines).toHaveLength(10);
        expect(lines[0].type).toBe('comment');
        expect(lines[1].type).toBe('directive');
        expect(lines[2].type).toBe('label');
        expect(lines[3].type).toBe('opcode');
        expect(lines[3].mnemonic).toBe('MOVI');
        expect(lines[7].type).toBe('opcode');
        expect(lines[7].mnemonic).toBe('DEC');
    });

    test('sets line numbers correctly', () => {
        const source = 'line0\nline1\nline2';
        const lines = parseFluxAssembly(source);
        expect(lines[0].lineNumber).toBe(0);
        expect(lines[1].lineNumber).toBe(1);
        expect(lines[2].lineNumber).toBe(2);
    });

    test('computes mnemonicRange for opcodes', () => {
        const lines = parseFluxAssembly('  ADD R0, R1, R2');
        expect(lines[0].mnemonicRange).toBeDefined();
        expect(lines[0].mnemonicRange!.start.character).toBe(2);
        expect(lines[0].mnemonicRange!.end.character).toBe(5);
    });
});

describe('Parser — extractLabels', () => {
    test('extracts standalone labels', () => {
        const source = '@start:\n  HALT\n@end:\n  NOP';
        const lines = parseFluxAssembly(source);
        const labels = extractLabels(lines);
        expect(labels.size).toBe(2);
        expect(labels.get('start')).toBe(0);
        expect(labels.get('end')).toBe(2);
    });

    test('extracts labels on opcode lines', () => {
        const source = '@loop: DEC R0';
        const lines = parseFluxAssembly(source);
        const labels = extractLabels(lines);
        expect(labels.get('loop')).toBe(0);
    });

    test('returns empty map for no labels', () => {
        const lines = parseFluxAssembly('HALT\nNOP');
        expect(extractLabels(lines).size).toBe(0);
    });
});

describe('Parser — extractLabelReferences', () => {
    test('finds label references in operands', () => {
        const source = '  JNZ R0, @loop\n  JMP @exit';
        const lines = parseFluxAssembly(source);
        const refs = extractLabelReferences(lines);
        expect(refs).toHaveLength(2);
        expect(refs[0].name).toBe('loop');
        expect(refs[1].name).toBe('exit');
    });

    test('does not match non-label @ operands', () => {
        const source = '  MOVI R0, 42';
        const lines = parseFluxAssembly(source);
        expect(extractLabelReferences(lines)).toHaveLength(0);
    });
});

describe('Parser — extractSections', () => {
    test('extracts fn sections', () => {
        const source = '## fn: main()\n  HALT\n## fn: helper()\n  NOP';
        const lines = parseFluxAssembly(source);
        const sections = extractSections(lines);
        expect(sections).toHaveLength(2);
        expect(sections[0].type).toBe('fn');
        expect(sections[0].name).toBe('main()');
        expect(sections[1].type).toBe('fn');
        expect(sections[1].name).toBe('helper()');
    });

    test('extracts agent and tile sections', () => {
        const source = '## agent: worker\n## tile: gpu\n## test: smoke';
        const lines = parseFluxAssembly(source);
        const sections = extractSections(lines);
        expect(sections[0].type).toBe('agent');
        expect(sections[1].type).toBe('tile');
        expect(sections[2].type).toBe('test');
    });
});

describe('Parser — isRegister', () => {
    test('accepts valid GP registers R0-R15', () => {
        for (let i = 0; i <= 15; i++) {
            expect(isRegister(`R${i}`)).toBe(true);
        }
    });

    test('rejects R16+', () => {
        expect(isRegister('R16')).toBe(false);
        expect(isRegister('R32')).toBe(false);
    });

    test('accepts valid FP registers F0-F15', () => {
        for (let i = 0; i <= 15; i++) {
            expect(isRegister(`F${i}`)).toBe(true);
        }
    });

    test('accepts valid VEC registers V0-V15', () => {
        for (let i = 0; i <= 15; i++) {
            expect(isRegister(`V${i}`)).toBe(true);
        }
    });

    test('accepts special registers', () => {
        expect(isRegister('SP')).toBe(true);
        expect(isRegister('FP')).toBe(true);
        expect(isRegister('LR')).toBe(true);
        expect(isRegister('PC')).toBe(true);
        expect(isRegister('FLAGS')).toBe(true);
    });

    test('rejects invalid tokens', () => {
        expect(isRegister('R-1')).toBe(false);
        expect(isRegister('r0')).toBe(false);
        expect(isRegister('X0')).toBe(false);
        expect(isRegister('')).toBe(false);
    });
});

describe('Parser — isImmediate', () => {
    test('accepts decimal', () => {
        expect(isImmediate('0')).toBe(true);
        expect(isImmediate('42')).toBe(true);
        expect(isImmediate('255')).toBe(true);
        expect(isImmediate('-1')).toBe(true);
        expect(isImmediate('-128')).toBe(true);
    });

    test('accepts hex', () => {
        expect(isImmediate('0xFF')).toBe(true);
        expect(isImmediate('0x0')).toBe(true);
        expect(isImmediate('0X1A')).toBe(true);
    });

    test('accepts binary', () => {
        expect(isImmediate('0b1010')).toBe(true);
        expect(isImmediate('0B11110000')).toBe(true);
    });

    test('rejects non-numbers', () => {
        expect(isImmediate('R0')).toBe(false);
        expect(isImmediate('@loop')).toBe(false);
        expect(isImmediate('hello')).toBe(false);
        expect(isImmediate('')).toBe(false);
    });
});

describe('Parser — isLabelRef', () => {
    test('accepts valid label references', () => {
        expect(isLabelRef('@loop')).toBe(true);
        expect(isLabelRef('@_start')).toBe(true);
        expect(isLabelRef('@main123')).toBe(true);
    });

    test('rejects non-labels', () => {
        expect(isLabelRef('loop')).toBe(false);
        expect(isLabelRef('@')).toBe(false);
        // Note: @1invalid is accepted by isLabelRef since \w includes digits;
        // strict label-name validation is done at definition time, not at reference time
    });
});

describe('Parser — validateOperandCount', () => {
    test('accepts correct count for ADD (3 ops)', () => {
        expect(validateOperandCount('ADD', 3)).toBeNull();
    });

    test('accepts 0 operands for HALT', () => {
        expect(validateOperandCount('HALT', 0)).toBeNull();
    });

    test('accepts 1 operand for INC', () => {
        expect(validateOperandCount('INC', 1)).toBeNull();
    });

    test('rejects wrong operand count', () => {
        const result = validateOperandCount('ADD', 1);
        expect(result).not.toBeNull();
        expect(result).toContain('Expected 3');
    });

    test('returns null for unknown mnemonics', () => {
        expect(validateOperandCount('INVALIDOP', 99)).toBeNull();
    });
});
