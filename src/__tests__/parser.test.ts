/**
 * Parser tests — FLUX Assembly parsing, tokenization, label/section extraction.
 */

import { describe, it, expect } from 'vitest';
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

// ─── parseFluxAssembly ─────────────────────────────────────────────────────

describe('parseFluxAssembly', () => {
    it('parses an empty string into one empty line', () => {
        const result = parseFluxAssembly('');
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('empty');
    });

    it('parses a single empty line', () => {
        const lines = parseFluxAssembly('');
        expect(lines).toHaveLength(1);
        expect(lines[0].type).toBe('empty');
    });

    it('parses whitespace-only lines as empty', () => {
        const result = parseFluxAssembly('   \n  \t  \n');
        expect(result).toHaveLength(3);
        expect(result[0].type).toBe('empty');
        expect(result[1].type).toBe('empty');
    });

    it('parses a simple opcode line', () => {
        const result = parseFluxAssembly('HALT');
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('opcode');
        expect(result[0].mnemonic).toBe('HALT');
        expect(result[0].operands).toEqual([]);
    });

    it('parses opcode with operands', () => {
        const result = parseFluxAssembly('ADD R0, R1, R2');
        expect(result[0].type).toBe('opcode');
        expect(result[0].mnemonic).toBe('ADD');
        expect(result[0].operands).toEqual(['R0', 'R1', 'R2']);
    });

    it('parses opcode with inline comment', () => {
        const result = parseFluxAssembly('MOVI R0, 42 ; load immediate');
        expect(result[0].mnemonic).toBe('MOVI');
        expect(result[0].operands).toEqual(['R0', '42']);
        expect(result[0].comment).toBe('load immediate');
    });

    it('parses a standalone label', () => {
        const result = parseFluxAssembly('@loop:');
        expect(result[0].type).toBe('label');
        expect(result[0].label).toBe('loop');
    });

    it('parses a label with opcode on same line', () => {
        const result = parseFluxAssembly('@start: MOVI R0, 1');
        expect(result[0].type).toBe('opcode');
        expect(result[0].label).toBe('start');
        expect(result[0].mnemonic).toBe('MOVI');
        expect(result[0].operands).toEqual(['R0', '1']);
    });

    it('parses semicolon comment lines', () => {
        const result = parseFluxAssembly('; this is a comment');
        expect(result[0].type).toBe('comment');
        expect(result[0].comment).toBe('this is a comment');
    });

    it('parses hash comment lines', () => {
        const result = parseFluxAssembly('# this is a hash comment');
        expect(result[0].type).toBe('comment');
        expect(result[0].comment).toBe('this is a hash comment');
    });

    it('does not treat #! lines as comments', () => {
        const result = parseFluxAssembly('#!capability arithmetic');
        expect(result[0].type).toBe('directive_comment');
        expect(result[0].directive).toBe('#!capability');
        expect(result[0].label).toBe('arithmetic');
    });

    it('parses section headings', () => {
        const result = parseFluxAssembly('## fn: factorial(n: i32) -> i32');
        expect(result[0].type).toBe('section');
        expect(result[0].directive).toBe('fn');
        expect(result[0].label).toBe('factorial(n: i32) -> i32');
    });

    it('parses all section types', () => {
        for (const type of ['fn', 'agent', 'tile', 'region', 'vocabulary', 'test']) {
            const result = parseFluxAssembly(`## ${type}: my_${type}`);
            expect(result[0].type).toBe('section');
            expect(result[0].directive).toBe(type);
        }
    });

    it('parses assembler directives', () => {
        const result = parseFluxAssembly('.global main');
        expect(result[0].type).toBe('directive');
        expect(result[0].directive).toBe('.global');
        expect(result[0].operands).toEqual(['main']);
    });

    it('parses directives with multiple operands', () => {
        const result = parseFluxAssembly('.word 1, 2, 3, 4');
        expect(result[0].type).toBe('directive');
        expect(result[0].operands).toEqual(['1', '2', '3', '4']);
    });

    it('sets lineNumber correctly', () => {
        const source = 'line0\nline1\nline2';
        const result = parseFluxAssembly(source);
        expect(result[0].lineNumber).toBe(0);
        expect(result[1].lineNumber).toBe(1);
        expect(result[2].lineNumber).toBe(2);
    });

    it('preserves original lineText', () => {
        const result = parseFluxAssembly('  ADD R0, R1, R2  ');
        expect(result[0].lineText).toBe('  ADD R0, R1, R2  ');
    });

    it('sets mnemonicRange for opcode lines', () => {
        const result = parseFluxAssembly('ADD R0, R1, R2');
        expect(result[0].mnemonicRange).toBeDefined();
        expect(result[0].mnemonicRange!.start.line).toBe(0);
        expect(result[0].mnemonicRange!.start.character).toBe(0);
        expect(result[0].mnemonicRange!.end.character).toBe(3);
    });

    it('falls back to empty for unknown/malformed lines', () => {
        const result = parseFluxAssembly('notAnOpcodeOrLabel');
        expect(result[0].type).toBe('empty');
    });

    it('handles multiline source correctly', () => {
        const source = [
            '; comment',
            '@loop:',
            '  ADD R0, R0, R1',
            '  INC R0',
            '  HALT',
        ].join('\n');
        const result = parseFluxAssembly(source);
        expect(result).toHaveLength(5);
        expect(result[0].type).toBe('comment');
        expect(result[1].type).toBe('label');
        expect(result[2].type).toBe('opcode');
        expect(result[2].mnemonic).toBe('ADD');
        expect(result[3].type).toBe('opcode');
        expect(result[3].mnemonic).toBe('INC');
        expect(result[4].type).toBe('opcode');
        expect(result[4].mnemonic).toBe('HALT');
    });
});

// ─── extractLabels ──────────────────────────────────────────────────────────

describe('extractLabels', () => {
    it('extracts standalone labels', () => {
        const source = '@start:\n@loop:\n@end:';
        const lines = parseFluxAssembly(source);
        const labels = extractLabels(lines);
        expect(labels.size).toBe(3);
        expect(labels.get('start')).toBe(0);
        expect(labels.get('loop')).toBe(1);
        expect(labels.get('end')).toBe(2);
    });

    it('extracts labels from label+opcode lines', () => {
        const source = '@entry: MOVI R0, 1\nHALT';
        const lines = parseFluxAssembly(source);
        const labels = extractLabels(lines);
        expect(labels.get('entry')).toBe(0);
    });

    it('does not extract from comment-only lines', () => {
        const source = '; @fake_label:\n@real_label:';
        const lines = parseFluxAssembly(source);
        const labels = extractLabels(lines);
        expect(labels.has('fake_label')).toBe(false);
        expect(labels.has('real_label')).toBe(true);
    });

    it('returns empty map for no labels', () => {
        const lines = parseFluxAssembly('HALT\nNOP');
        expect(extractLabels(lines).size).toBe(0);
    });
});

// ─── extractLabelInfos ──────────────────────────────────────────────────────

describe('extractLabelInfos', () => {
    it('extracts label info with positions', () => {
        const source = '@start:\nADD R0, R1, R2';
        const lines = parseFluxAssembly(source);
        const infos = extractLabelInfos(lines);
        expect(infos).toHaveLength(1);
        expect(infos[0].name).toBe('start');
        expect(infos[0].line).toBe(0);
        expect(infos[0].position).toEqual({ line: 0, character: 0 });
    });
});

// ─── extractSections ────────────────────────────────────────────────────────

describe('extractSections', () => {
    it('extracts section definitions', () => {
        const source = '## fn: add\n## fn: sub\n## agent: calc';
        const lines = parseFluxAssembly(source);
        const sections = extractSections(lines);
        expect(sections).toHaveLength(3);
        expect(sections[0].type).toBe('fn');
        expect(sections[0].name).toBe('add');
        expect(sections[1].type).toBe('fn');
        expect(sections[1].name).toBe('sub');
        expect(sections[2].type).toBe('agent');
        expect(sections[2].name).toBe('calc');
    });

    it('returns empty array for no sections', () => {
        const lines = parseFluxAssembly('HALT');
        expect(extractSections(lines)).toHaveLength(0);
    });
});

// ─── extractLabelReferences ─────────────────────────────────────────────────

describe('extractLabelReferences', () => {
    it('finds label references in operands', () => {
        const source = 'JMP @loop\nADD R0, @data, R1';
        const lines = parseFluxAssembly(source);
        const refs = extractLabelReferences(lines);
        expect(refs).toHaveLength(2);
        expect(refs[0].name).toBe('loop');
        expect(refs[1].name).toBe('data');
    });

    it('does not find label references in non-operand positions', () => {
        const source = '@label:\nNOP';
        const lines = parseFluxAssembly(source);
        const refs = extractLabelReferences(lines);
        expect(refs).toHaveLength(0);
    });

    it('returns empty for no references', () => {
        const lines = parseFluxAssembly('HALT');
        expect(extractLabelReferences(lines)).toHaveLength(0);
    });
});

// ─── validateOperandCount ───────────────────────────────────────────────────

describe('validateOperandCount', () => {
    it('returns null for correct operand count (ADD with 3)', () => {
        expect(validateOperandCount('ADD', 3)).toBeNull();
    });

    it('returns null for zero-operand opcodes', () => {
        expect(validateOperandCount('HALT', 0)).toBeNull();
    });

    it('returns null for single-register opcodes', () => {
        expect(validateOperandCount('INC', 1)).toBeNull();
    });

    it('returns null for immediate-only opcodes', () => {
        expect(validateOperandCount('SYS', 1)).toBeNull();
    });

    it('returns null for reg+imm8 opcodes', () => {
        expect(validateOperandCount('MOVI', 2)).toBeNull();
    });

    it('returns null for unknown mnemonics (handled elsewhere)', () => {
        expect(validateOperandCount('FAKEOP', 5)).toBeNull();
    });

    it('returns error message for wrong count', () => {
        const result = validateOperandCount('ADD', 1);
        expect(result).not.toBeNull();
        expect(result).toContain('Expected 3 operand');
        expect(result).toContain('ADD');
    });

    it('accepts MOV with 2 operands (has unused 3rd)', () => {
        // MOV format E has rd, rs1, - — but it's common to write MOV R0, R1
        expect(validateOperandCount('MOV', 2)).toBeNull();
        expect(validateOperandCount('MOV', 3)).toBeNull();
    });

    it('returns error for ADD with 0 operands', () => {
        const result = validateOperandCount('ADD', 0);
        expect(result).not.toBeNull();
    });
});

// ─── isRegister ─────────────────────────────────────────────────────────────

describe('isRegister', () => {
    it('accepts GP registers R0-R15', () => {
        for (let i = 0; i <= 15; i++) {
            expect(isRegister(`R${i}`)).toBe(true);
        }
    });

    it('rejects R16+', () => {
        expect(isRegister('R16')).toBe(false);
        expect(isRegister('R100')).toBe(false);
    });

    it('accepts FP registers F0-F15', () => {
        for (let i = 0; i <= 15; i++) {
            expect(isRegister(`F${i}`)).toBe(true);
        }
    });

    it('accepts VEC registers V0-V15', () => {
        for (let i = 0; i <= 15; i++) {
            expect(isRegister(`V${i}`)).toBe(true);
        }
    });

    it('accepts special registers', () => {
        expect(isRegister('SP')).toBe(true);
        expect(isRegister('FP')).toBe(true);
        expect(isRegister('LR')).toBe(true);
        expect(isRegister('PC')).toBe(true);
        expect(isRegister('FLAGS')).toBe(true);
    });

    it('rejects invalid registers', () => {
        expect(isRegister('R-1')).toBe(false);
        expect(isRegister('RX')).toBe(false);
        expect(isRegister('sp')).toBe(false); // lowercase
        expect(isRegister('')).toBe(false);
        expect(isRegister('0')).toBe(false);
    });
});

// ─── isImmediate ────────────────────────────────────────────────────────────

describe('isImmediate', () => {
    it('accepts decimal numbers', () => {
        expect(isImmediate('0')).toBe(true);
        expect(isImmediate('42')).toBe(true);
        expect(isImmediate('255')).toBe(true);
    });

    it('accepts negative numbers', () => {
        expect(isImmediate('-1')).toBe(true);
        expect(isImmediate('-128')).toBe(true);
    });

    it('accepts hexadecimal', () => {
        expect(isImmediate('0xFF')).toBe(true);
        expect(isImmediate('0x00')).toBe(true);
        expect(isImmediate('0XAB')).toBe(true);
    });

    it('accepts binary', () => {
        expect(isImmediate('0b101010')).toBe(true);
        expect(isImmediate('0B11110000')).toBe(true);
    });

    it('rejects non-numbers', () => {
        expect(isImmediate('R0')).toBe(false);
        expect(isImmediate('@label')).toBe(false);
        expect(isImmediate('')).toBe(false);
        expect(isImmediate('abc')).toBe(false);
        expect(isImmediate('0xGZ')).toBe(false);
    });
});

// ─── isLabelRef ─────────────────────────────────────────────────────────────

describe('isLabelRef', () => {
    it('accepts @word', () => {
        expect(isLabelRef('@loop')).toBe(true);
        expect(isLabelRef('@start')).toBe(true);
        expect(isLabelRef('@my_label_123')).toBe(true);
    });

    it('rejects non-label-refs', () => {
        expect(isLabelRef('loop')).toBe(false);
        expect(isLabelRef('@')).toBe(false);
        expect(isLabelRef('@1')).toBe(true); // \w includes digits — @1 is technically a valid label ref per isLabelRef
        expect(isLabelRef('')).toBe(false);
    });
});
