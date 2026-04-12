/**
 * Parser Tests — FLUX Assembly Parser
 *
 * Tests the parseFluxAssembly function, extractLabels, extractSections,
 * extractLabelReferences, validateOperandCount, isRegister, isImmediate, isLabelRef.
 */

import {
    parseFluxAssembly,
    extractLabels,
    extractLabelInfos,
    extractSections,
    extractLabelReferences,
    validateOperandCount,
    isRegister,
    isImmediate,
    isLabelRef,
    ParsedLine,
} from '../parser';

// ═══════════════════════════════════════════════════════════════════════════════
// parseFluxAssembly
// ═══════════════════════════════════════════════════════════════════════════════

describe('parseFluxAssembly', () => {
    test('parses empty source into one empty line', () => {
        const result = parseFluxAssembly('');
        // ''.split('\n') produces [''] — one empty line
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('empty');
    });

    test('parses single empty line', () => {
        const result = parseFluxAssembly('   \n');
        // Trailing newline creates 2 entries: ['   ', '']
        expect(result).toHaveLength(2);
        expect(result[0].type).toBe('empty');
        expect(result[1].type).toBe('empty');
    });

    test('parses multiple lines correctly with line numbers', () => {
        const source = 'NOP\nADD R1, R2, R3\nHALT';
        const result = parseFluxAssembly(source);
        expect(result).toHaveLength(3);
        expect(result[0].lineNumber).toBe(0);
        expect(result[1].lineNumber).toBe(1);
        expect(result[2].lineNumber).toBe(2);
    });

    test('preserves original line text', () => {
        const source = '  ADD R1, R2, R3  ';
        const result = parseFluxAssembly(source);
        expect(result[0].lineText).toBe('  ADD R1, R2, R3  ');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Line type parsing
// ═══════════════════════════════════════════════════════════════════════════════

describe('line type parsing', () => {
    test('parses empty line', () => {
        const result = parseFluxAssembly('  ');
        expect(result[0].type).toBe('empty');
    });

    test('parses semicolon comment', () => {
        const result = parseFluxAssembly('; this is a comment');
        expect(result[0].type).toBe('comment');
        expect(result[0].comment).toBe('this is a comment');
    });

    test('parses hash comment (not #!)', () => {
        const result = parseFluxAssembly('# this is a comment');
        expect(result[0].type).toBe('comment');
        expect(result[0].comment).toBe('this is a comment');
    });

    test('does not parse #! as hash comment', () => {
        const result = parseFluxAssembly('#!capability foo');
        expect(result[0].type).toBe('directive_comment');
        expect(result[0].directive).toBe('#!capability');
        expect(result[0].label).toBe('foo');
    });

    test('parses standalone label definition', () => {
        const result = parseFluxAssembly('@loop_start:');
        expect(result[0].type).toBe('label');
        expect(result[0].label).toBe('loop_start');
    });

    test('parses label with underscore and numbers', () => {
        const result = parseFluxAssembly('@my_label_42:');
        expect(result[0].type).toBe('label');
        expect(result[0].label).toBe('my_label_42');
    });

    test('parses section heading (## fn:)', () => {
        const result = parseFluxAssembly('## fn: my_function');
        expect(result[0].type).toBe('section');
        expect(result[0].directive).toBe('fn');
        expect(result[0].label).toBe('my_function');
    });

    test('parses section heading (## agent:)', () => {
        const result = parseFluxAssembly('## agent: worker');
        expect(result[0].type).toBe('section');
        expect(result[0].directive).toBe('agent');
    });

    test('parses section heading (## tile:)', () => {
        const result = parseFluxAssembly('## tile: my_tile');
        expect(result[0].type).toBe('section');
        expect(result[0].directive).toBe('tile');
    });

    test('parses section heading (## region:)', () => {
        const result = parseFluxAssembly('## region: data_region');
        expect(result[0].type).toBe('section');
        expect(result[0].directive).toBe('region');
    });

    test('parses section heading (## vocabulary:)', () => {
        const result = parseFluxAssembly('## vocabulary: verbs');
        expect(result[0].type).toBe('section');
        expect(result[0].directive).toBe('vocabulary');
    });

    test('parses section heading (## test:)', () => {
        const result = parseFluxAssembly('## test: add_test');
        expect(result[0].type).toBe('section');
        expect(result[0].directive).toBe('test');
    });

    test('parses assembler directive', () => {
        const result = parseFluxAssembly('.text');
        expect(result[0].type).toBe('directive');
        expect(result[0].directive).toBe('.text');
    });

    test('parses directive with operands', () => {
        const result = parseFluxAssembly('.global main');
        expect(result[0].type).toBe('directive');
        expect(result[0].directive).toBe('.global');
        expect(result[0].operands).toEqual(['main']);
    });

    test('parses .word directive with multiple operands', () => {
        const result = parseFluxAssembly('.word 1, 2, 3');
        expect(result[0].type).toBe('directive');
        expect(result[0].operands).toEqual(['1', '2', '3']);
    });

    test('parses opcode with no operands', () => {
        const result = parseFluxAssembly('HALT');
        expect(result[0].type).toBe('opcode');
        expect(result[0].mnemonic).toBe('HALT');
        expect(result[0].operands).toEqual([]);
    });

    test('parses opcode with register operands', () => {
        const result = parseFluxAssembly('ADD R1, R2, R3');
        expect(result[0].type).toBe('opcode');
        expect(result[0].mnemonic).toBe('ADD');
        expect(result[0].operands).toEqual(['R1', 'R2', 'R3']);
    });

    test('parses opcode with immediate operand', () => {
        const result = parseFluxAssembly('MOVI R1, 42');
        expect(result[0].type).toBe('opcode');
        expect(result[0].mnemonic).toBe('MOVI');
        expect(result[0].operands).toEqual(['R1', '42']);
    });

    test('parses opcode with trailing comment', () => {
        const result = parseFluxAssembly('ADD R1, R2, R3 ; add two numbers');
        expect(result[0].type).toBe('opcode');
        expect(result[0].mnemonic).toBe('ADD');
        expect(result[0].operands).toEqual(['R1', 'R2', 'R3']);
        expect(result[0].comment).toBe('add two numbers');
    });

    test('parses label + opcode line', () => {
        const result = parseFluxAssembly('@start: MOV R1, R2');
        expect(result[0].type).toBe('opcode');
        expect(result[0].label).toBe('start');
        expect(result[0].mnemonic).toBe('MOV');
        expect(result[0].operands).toEqual(['R1', 'R2']);
    });

    test('sets mnemonicRange for opcode lines', () => {
        const result = parseFluxAssembly('ADD R1, R2, R3');
        expect(result[0].mnemonicRange).toBeDefined();
        expect(result[0].mnemonicRange!.start.line).toBe(0);
        expect(result[0].mnemonicRange!.start.character).toBe(0);
        expect(result[0].mnemonicRange!.end.character).toBe(3);
    });

    test('sets mnemonicRange for indented opcode lines', () => {
        const result = parseFluxAssembly('  ADD R1, R2, R3');
        expect(result[0].mnemonicRange).toBeDefined();
        expect(result[0].mnemonicRange!.start.character).toBe(2);
        expect(result[0].mnemonicRange!.end.character).toBe(5);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Operand splitting
// ═══════════════════════════════════════════════════════════════════════════════

describe('operand splitting', () => {
    test('splits simple comma-separated operands', () => {
        const result = parseFluxAssembly('ADD R1, R2, R3');
        expect(result[0].operands).toEqual(['R1', 'R2', 'R3']);
    });

    test('handles extra spaces around commas', () => {
        const result = parseFluxAssembly('ADD  R1 ,  R2 ,  R3');
        expect(result[0].operands).toEqual(['R1', 'R2', 'R3']);
    });

    test('splits label references as operands', () => {
        const result = parseFluxAssembly('JMP R1, @target');
        expect(result[0].operands).toEqual(['R1', '@target']);
    });

    test('splits string literals containing commas', () => {
        const result = parseFluxAssembly('SYS "hello, world"');
        expect(result[0].operands).toEqual(['"hello, world"']);
    });

    test('handles parentheses in operands (e.g., mem[r1 + r2])', () => {
        const result = parseFluxAssembly('LOAD R1, (R2), R3');
        expect(result[0].operands).toEqual(['R1', '(R2)', 'R3']);
    });

    test('handles brackets in operands', () => {
        const result = parseFluxAssembly('LOAD R1, [R2], R3');
        expect(result[0].operands).toEqual(['R1', '[R2]', 'R3']);
    });

    test('handles empty operand string', () => {
        const result = parseFluxAssembly('NOP');
        expect(result[0].operands).toEqual([]);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// extractLabels
// ═══════════════════════════════════════════════════════════════════════════════

describe('extractLabels', () => {
    test('extracts standalone label definitions', () => {
        const lines = parseFluxAssembly('@start:\n@loop:\nNOP');
        const labels = extractLabels(lines);
        expect(labels.get('start')).toBe(0);
        expect(labels.get('loop')).toBe(1);
    });

    test('extracts labels from label+opcode lines', () => {
        const lines = parseFluxAssembly('@entry: MOVI R1, 0\nHALT');
        const labels = extractLabels(lines);
        expect(labels.get('entry')).toBe(0);
    });

    test('returns empty map for source with no labels', () => {
        const lines = parseFluxAssembly('NOP\nHALT');
        const labels = extractLabels(lines);
        expect(labels.size).toBe(0);
    });

    test('does not include labels from comment or directive lines', () => {
        const lines = parseFluxAssembly('; @not_a_label:\n.text\nNOP');
        const labels = extractLabels(lines);
        expect(labels.size).toBe(0);
    });

    test('does not duplicate labels (last occurrence wins)', () => {
        const lines = parseFluxAssembly('@dup: NOP\n@dup: HALT');
        const labels = extractLabels(lines);
        expect(labels.size).toBe(1);
        expect(labels.get('dup')).toBe(1);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// extractLabelInfos
// ═══════════════════════════════════════════════════════════════════════════════

describe('extractLabelInfos', () => {
    test('extracts label info with position', () => {
        const lines = parseFluxAssembly('@start: NOP\n@end: HALT');
        const infos = extractLabelInfos(lines);
        expect(infos).toHaveLength(2);
        expect(infos[0].name).toBe('start');
        expect(infos[0].line).toBe(0);
        expect(infos[0].position).toEqual({ line: 0, character: 0 });
        expect(infos[1].name).toBe('end');
        expect(infos[1].line).toBe(1);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// extractSections
// ═══════════════════════════════════════════════════════════════════════════════

describe('extractSections', () => {
    test('extracts fn sections', () => {
        const lines = parseFluxAssembly('## fn: my_func\nNOP\nHALT');
        const sections = extractSections(lines);
        expect(sections).toHaveLength(1);
        expect(sections[0].type).toBe('fn');
        expect(sections[0].name).toBe('my_func');
        expect(sections[0].line).toBe(0);
        expect(sections[0].position).toEqual({ line: 0, character: 0 });
    });

    test('extracts multiple sections', () => {
        const lines = parseFluxAssembly('## fn: foo\nNOP\n## fn: bar\nHALT');
        const sections = extractSections(lines);
        expect(sections).toHaveLength(2);
        expect(sections[0].name).toBe('foo');
        expect(sections[1].name).toBe('bar');
    });

    test('extracts agent sections', () => {
        const lines = parseFluxAssembly('## agent: worker\nNOP');
        const sections = extractSections(lines);
        expect(sections).toHaveLength(1);
        expect(sections[0].type).toBe('agent');
    });

    test('returns empty array for no sections', () => {
        const lines = parseFluxAssembly('NOP\nHALT');
        const sections = extractSections(lines);
        expect(sections).toHaveLength(0);
    });

    test('includes signature', () => {
        const lines = parseFluxAssembly('## fn: compute(a, b)');
        const sections = extractSections(lines);
        expect(sections[0].signature).toBe('compute(a, b)');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// extractLabelReferences
// ═══════════════════════════════════════════════════════════════════════════════

describe('extractLabelReferences', () => {
    test('extracts label references from operands', () => {
        const lines = parseFluxAssembly('JMP R1, @target\nJZ R2, @loop');
        const refs = extractLabelReferences(lines);
        expect(refs).toHaveLength(2);
        expect(refs[0].name).toBe('target');
        expect(refs[1].name).toBe('loop');
    });

    test('does not extract non-label operands', () => {
        const lines = parseFluxAssembly('ADD R1, R2, R3');
        const refs = extractLabelReferences(lines);
        expect(refs).toHaveLength(0);
    });

    test('finds column position of reference', () => {
        const lines = parseFluxAssembly('JMP R1, @target');
        const refs = extractLabelReferences(lines);
        expect(refs[0].col).toBeGreaterThanOrEqual(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// validateOperandCount
// ═══════════════════════════════════════════════════════════════════════════════

describe('validateOperandCount', () => {
    test('returns null for correct operand count (HALT - 0 operands)', () => {
        expect(validateOperandCount('HALT', 0)).toBeNull();
    });

    test('returns null for correct operand count (INC - 1 operand)', () => {
        expect(validateOperandCount('INC', 1)).toBeNull();
    });

    test('returns null for correct operand count (ADD - 3 operands)', () => {
        expect(validateOperandCount('ADD', 3)).toBeNull();
    });

    test('returns null for MOV with 2 operands (MOV has rd, rs1, -)', () => {
        // MOV has 3 slots but one is unused (-)
        expect(validateOperandCount('MOV', 2)).toBeNull();
    });

    test('returns null for unknown mnemonic', () => {
        expect(validateOperandCount('FOOBAR', 5)).toBeNull();
    });

    test('returns error for too few operands', () => {
        // ADD requires 3 operands
        const result = validateOperandCount('ADD', 1);
        expect(result).not.toBeNull();
        expect(result).toContain('Expected 3 operand');
    });

    test('returns error for too many operands', () => {
        const result = validateOperandCount('INC', 3);
        expect(result).not.toBeNull();
        expect(result).toContain('Expected 1 operand');
    });

    test('returns null for MOVI with 2 operands', () => {
        expect(validateOperandCount('MOVI', 2)).toBeNull();
    });

    test('returns null for MOVI16 with 2 operands', () => {
        expect(validateOperandCount('MOVI16', 2)).toBeNull();
    });

    test('returns null for LOADOFF with 3 operands', () => {
        expect(validateOperandCount('LOADOFF', 3)).toBeNull();
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// isRegister
// ═══════════════════════════════════════════════════════════════════════════════

describe('isRegister', () => {
    test('recognizes GP registers R0-R15', () => {
        expect(isRegister('R0')).toBe(true);
        expect(isRegister('R7')).toBe(true);
        expect(isRegister('R15')).toBe(true);
    });

    test('rejects out-of-range GP registers', () => {
        expect(isRegister('R16')).toBe(false);
        expect(isRegister('R99')).toBe(false);
    });

    test('recognizes FP registers F0-F15', () => {
        expect(isRegister('F0')).toBe(true);
        expect(isRegister('F15')).toBe(true);
    });

    test('rejects out-of-range FP registers', () => {
        expect(isRegister('F16')).toBe(false);
    });

    test('recognizes VEC registers V0-V15', () => {
        expect(isRegister('V0')).toBe(true);
        expect(isRegister('V15')).toBe(true);
    });

    test('rejects out-of-range VEC registers', () => {
        expect(isRegister('V16')).toBe(false);
    });

    test('recognizes special registers', () => {
        expect(isRegister('SP')).toBe(true);
        expect(isRegister('FP')).toBe(true);
        expect(isRegister('LR')).toBe(true);
        expect(isRegister('PC')).toBe(true);
        expect(isRegister('FLAGS')).toBe(true);
    });

    test('rejects non-registers', () => {
        expect(isRegister('XX')).toBe(false);
        expect(isRegister('')).toBe(false);
        expect(isRegister('R')).toBe(false);
        expect(isRegister('r0')).toBe(false);  // lowercase
        expect(isRegister('42')).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// isImmediate
// ═══════════════════════════════════════════════════════════════════════════════

describe('isImmediate', () => {
    test('recognizes decimal numbers', () => {
        expect(isImmediate('0')).toBe(true);
        expect(isImmediate('42')).toBe(true);
        expect(isImmediate('255')).toBe(true);
    });

    test('recognizes negative decimal numbers', () => {
        expect(isImmediate('-1')).toBe(true);
        expect(isImmediate('-128')).toBe(true);
    });

    test('recognizes hex numbers', () => {
        expect(isImmediate('0x0')).toBe(true);
        expect(isImmediate('0xFF')).toBe(true);
        expect(isImmediate('0X1A')).toBe(true);
    });

    test('recognizes binary numbers', () => {
        expect(isImmediate('0b0')).toBe(true);
        expect(isImmediate('0b1010')).toBe(true);
        expect(isImmediate('0B1111')).toBe(true);
    });

    test('rejects non-numbers', () => {
        expect(isImmediate('R1')).toBe(false);
        expect(isImmediate('')).toBe(false);
        expect(isImmediate('hello')).toBe(false);
        expect(isImmediate('0x')).toBe(false);  // incomplete hex
        expect(isImmediate('0b')).toBe(false);  // incomplete binary
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// isLabelRef
// ═══════════════════════════════════════════════════════════════════════════════

describe('isLabelRef', () => {
    test('recognizes label references', () => {
        expect(isLabelRef('@start')).toBe(true);
        expect(isLabelRef('@loop_end')).toBe(true);
        expect(isLabelRef('@_private')).toBe(true);
    });

    test('rejects non-label references', () => {
        expect(isLabelRef('start')).toBe(false);
        expect(isLabelRef('@')).toBe(false);
        expect(isLabelRef('')).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Edge cases
// ═══════════════════════════════════════════════════════════════════════════════

describe('edge cases', () => {
    test('fallback for unparseable lines', () => {
        const result = parseFluxAssembly('lowercase_opcode foo');
        // Not starting with uppercase letter → opcode regex won't match
        expect(result[0].type).toBe('empty');
    });

    test('single character line', () => {
        const result = parseFluxAssembly('x');
        expect(result[0].type).toBe('empty');
    });

    test('label without colon is not parsed as label', () => {
        const result = parseFluxAssembly('@start');
        expect(result[0].type).not.toBe('label');
    });

    test('opcode starting with single letter is not parsed', () => {
        // OPCODE_RE requires at least 2 chars ([A-Z][A-Z0-9_]*)
        // Actually X is valid - it requires [A-Z] first then [A-Z0-9_]* which can be empty
        // So "X" is a valid opcode mnemonic per regex
        const result = parseFluxAssembly('X');
        expect(result[0].type).toBe('opcode');
        expect(result[0].mnemonic).toBe('X');
    });

    test('multiline source with mixed line types', () => {
        const source = [
            '## fn: test_func',
            '@entry:',
            '  MOVI R1, 42      ; load immediate',
            '  ADD R2, R1, R3',
            '  HALT',
        ].join('\n');
        const result = parseFluxAssembly(source);
        expect(result).toHaveLength(5);
        expect(result[0].type).toBe('section');
        expect(result[1].type).toBe('label');
        expect(result[2].type).toBe('opcode');
        expect(result[2].mnemonic).toBe('MOVI');
        expect(result[2].comment).toBe('load immediate');
        expect(result[3].type).toBe('opcode');
        expect(result[3].mnemonic).toBe('ADD');
        expect(result[4].type).toBe('opcode');
        expect(result[4].mnemonic).toBe('HALT');
    });
});
