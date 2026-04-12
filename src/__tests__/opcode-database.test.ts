/**
 * Opcode database tests — lookup, completion items, register lists, format descriptions.
 */

import { describe, it, expect } from 'vitest';
import {
    OPCODE_DATABASE,
    lookupOpcode,
    getOpcodesByCategory,
    getCategories,
    getFormatDescription,
    formatOpcodeMarkdown,
    getOpcodeCompletionItems,
    getRegisterCompletionItems,
    getDirectiveCompletionItems,
    GP_REGISTERS,
    FP_REGISTERS,
    VEC_REGISTERS,
    SPECIAL_REGISTERS,
    ALL_REGISTERS,
    DIRECTIVES,
    OpcodeInfo,
    FormatType,
} from '../opcode-database';

// ─── OPCODE_DATABASE ───────────────────────────────────────────────────────

describe('OPCODE_DATABASE', () => {
    it('has entries for all major opcodes', () => {
        const keyOpcodes = [
            'HALT', 'NOP', 'RET', 'BRK',
            'INC', 'DEC', 'NOT', 'NEG', 'PUSH', 'POP',
            'MOVI', 'ADDI', 'SUBI',
            'ADD', 'SUB', 'MUL', 'DIV', 'MOD',
            'LOAD', 'STORE', 'MOV', 'SWP',
            'JZ', 'JNZ', 'JLT', 'JGT', 'JMP', 'JAL', 'CALL',
            'MOVI16', 'ADDI16', 'SUBI16',
            'LOADOFF', 'STOREOF',
            'CMP_EQ', 'CMP_LT', 'CMP_GT', 'CMP_NE',
            'SYS', 'TRAP', 'DBG',
            'TELL', 'ASK', 'DELEG', 'BCAST', 'FORK', 'JOIN',
            'HALT_ERR', 'DUMP', 'ASSERT', 'VER', 'ILLEGAL',
        ];
        for (const op of keyOpcodes) {
            expect(OPCODE_DATABASE.has(op), `Missing opcode: ${op}`).toBe(true);
        }
    });

    it('has at least 200 opcodes (full ISA coverage)', () => {
        expect(OPCODE_DATABASE.size).toBeGreaterThanOrEqual(200);
    });

    it('each entry has valid format', () => {
        const validFormats: FormatType[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
        for (const [mnemonic, info] of OPCODE_DATABASE) {
            expect(validFormats).toContain(info.format);
            expect(info.mnemonic).toBe(mnemonic);
            expect(info.opcode).toBeGreaterThanOrEqual(0x00);
            expect(info.opcode).toBeLessThanOrEqual(0xFF);
            expect(typeof info.description).toBe('string');
            expect(typeof info.category).toBe('string');
            expect(Array.isArray(info.operands)).toBe(true);
            expect(typeof info.implemented).toBe('boolean');
        }
    });

    it('has correct opcode values for system control range (0x00-0x07)', () => {
        expect(OPCODE_DATABASE.get('HALT')!.opcode).toBe(0x00);
        expect(OPCODE_DATABASE.get('NOP')!.opcode).toBe(0x01);
        expect(OPCODE_DATABASE.get('RET')!.opcode).toBe(0x02);
        expect(OPCODE_DATABASE.get('BRK')!.opcode).toBe(0x04);
    });

    it('has correct format A for zero-operand opcodes', () => {
        const formatA = ['HALT', 'NOP', 'RET', 'IRET', 'BRK', 'WFI', 'RESET', 'SYN'];
        for (const op of formatA) {
            expect(OPCODE_DATABASE.get(op)!.format).toBe('A');
            expect(OPCODE_DATABASE.get(op)!.operands).toHaveLength(0);
        }
    });

    it('has no duplicate opcodes', () => {
        const seen = new Set<number>();
        for (const [, info] of OPCODE_DATABASE) {
            expect(seen.has(info.opcode), `Duplicate opcode value: 0x${info.opcode.toString(16)} (${info.mnemonic})`).toBe(false);
            seen.add(info.opcode);
        }
    });
});

// ─── lookupOpcode ───────────────────────────────────────────────────────────

describe('lookupOpcode', () => {
    it('finds HALT', () => {
        const info = lookupOpcode('HALT');
        expect(info).toBeDefined();
        expect(info!.mnemonic).toBe('HALT');
        expect(info!.format).toBe('A');
        expect(info!.implemented).toBe(true);
    });

    it('is case-insensitive', () => {
        expect(lookupOpcode('halt')).toBeDefined();
        expect(lookupOpcode('Halt')).toBeDefined();
        expect(lookupOpcode('HaLt')).toBeDefined();
    });

    it('returns undefined for unknown opcodes', () => {
        expect(lookupOpcode('FAKEOP')).toBeUndefined();
        expect(lookupOpcode('')).toBeUndefined();
        expect(lookupOpcode('add')).toBeDefined(); // lowercase works
    });

    it('finds opcodes across all categories', () => {
        const categories = new Set<string>();
        // Sample opcodes from different ranges
        const samples = ['HALT', 'INC', 'SYS', 'MOVI', 'ADD', 'LOAD', 'JMP',
            'LOADOFF', 'TELL', 'C_ADD', 'V_EVID', 'SENSE', 'ABS', 'LEN',
            'VLOAD', 'TMATMUL', 'DMA_CPY', 'JMPL', 'HALT_ERR'];
        for (const op of samples) {
            const info = lookupOpcode(op);
            expect(info, `Expected to find ${op}`).toBeDefined();
            categories.add(info!.category);
        }
        // Should cover at least 10 different categories
        expect(categories.size).toBeGreaterThanOrEqual(10);
    });
});

// ─── getCategories ──────────────────────────────────────────────────────────

describe('getCategories', () => {
    it('returns sorted array of categories', () => {
        const cats = getCategories();
        expect(cats.length).toBeGreaterThanOrEqual(10);
        // Verify sorted
        const sorted = [...cats].sort();
        expect(cats).toEqual(sorted);
    });

    it('includes expected categories', () => {
        const cats = getCategories();
        expect(cats).toContain('system');
        expect(cats).toContain('arithmetic');
        expect(cats).toContain('memory');
        expect(cats).toContain('control');
        expect(cats).toContain('debug');
        expect(cats).toContain('a2a');
        expect(cats).toContain('confidence');
    });
});

// ─── getOpcodesByCategory ──────────────────────────────────────────────────

describe('getOpcodesByCategory', () => {
    it('returns opcodes for a given category', () => {
        const systemOps = getOpcodesByCategory('system');
        expect(systemOps.length).toBeGreaterThanOrEqual(5);
        for (const op of systemOps) {
            expect(op.category).toBe('system');
        }
    });

    it('returns empty array for unknown category', () => {
        expect(getOpcodesByCategory('nonexistent')).toEqual([]);
    });
});

// ─── getFormatDescription ──────────────────────────────────────────────────

describe('getFormatDescription', () => {
    it('returns descriptions for all formats', () => {
        const formats: FormatType[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
        for (const fmt of formats) {
            const desc = getFormatDescription(fmt);
            expect(desc.length).toBeGreaterThan(5);
            expect(desc).toContain('byte');
        }
    });

    it('Format A is 1 byte', () => {
        expect(getFormatDescription('A')).toContain('1 byte');
    });

    it('Format G is 5 bytes', () => {
        expect(getFormatDescription('G')).toContain('5 bytes');
    });
});

// ─── formatOpcodeMarkdown ──────────────────────────────────────────────────

describe('formatOpcodeMarkdown', () => {
    it('produces markdown for HALT', () => {
        const info = lookupOpcode('HALT')!;
        const md = formatOpcodeMarkdown(info);
        expect(md).toContain('**HALT**');
        expect(md).toContain('0x00');
        expect(md).toContain('Format **A**');
        expect(md).toContain('(none)');
        expect(md).toContain('system');
    });

    it('produces markdown for ADD', () => {
        const info = lookupOpcode('ADD')!;
        const md = formatOpcodeMarkdown(info);
        expect(md).toContain('**ADD**');
        expect(md).toContain('0x20');
        expect(md).toContain('Format **E**');
        expect(md).toContain('rd, rs1, rs2');
        expect(md).toContain('rd = rs1 + rs2');
    });

    it('shows not-verified notice for unimplemented opcodes', () => {
        const info = lookupOpcode('RET')!;
        expect(info.implemented).toBe(false);
        const md = formatOpcodeMarkdown(info);
        expect(md).toContain('Not yet verified');
    });

    it('does not show notice for implemented opcodes', () => {
        const info = lookupOpcode('ADD')!;
        expect(info.implemented).toBe(true);
        const md = formatOpcodeMarkdown(info);
        expect(md).not.toContain('Not yet verified');
    });
});

// ─── Register constants ────────────────────────────────────────────────────

describe('Register constants', () => {
    it('GP_REGISTERS has R0-R15', () => {
        expect(GP_REGISTERS).toHaveLength(16);
        expect(GP_REGISTERS[0]).toBe('R0');
        expect(GP_REGISTERS[15]).toBe('R15');
    });

    it('FP_REGISTERS has F0-F15', () => {
        expect(FP_REGISTERS).toHaveLength(16);
        expect(FP_REGISTERS[0]).toBe('F0');
        expect(FP_REGISTERS[15]).toBe('F15');
    });

    it('VEC_REGISTERS has V0-V15', () => {
        expect(VEC_REGISTERS).toHaveLength(16);
        expect(VEC_REGISTERS[0]).toBe('V0');
        expect(VEC_REGISTERS[15]).toBe('V15');
    });

    it('SPECIAL_REGISTERS has SP, FP, LR, PC, FLAGS', () => {
        expect(SPECIAL_REGISTERS).toEqual(['SP', 'FP', 'LR', 'PC', 'FLAGS']);
    });

    it('ALL_REGISTERS has 53 entries (16+16+16+5)', () => {
        expect(ALL_REGISTERS).toHaveLength(53);
    });

    it('no duplicate registers in ALL_REGISTERS', () => {
        const seen = new Set<string>();
        for (const reg of ALL_REGISTERS) {
            expect(seen.has(reg), `Duplicate register: ${reg}`).toBe(false);
            seen.add(reg);
        }
    });
});

// ─── DIRECTIVES ────────────────────────────────────────────────────────────

describe('DIRECTIVES', () => {
    it('includes standard assembler directives', () => {
        expect(DIRECTIVES).toContain('.text');
        expect(DIRECTIVES).toContain('.data');
        expect(DIRECTIVES).toContain('.bss');
        expect(DIRECTIVES).toContain('.global');
        expect(DIRECTIVES).toContain('.word');
        expect(DIRECTIVES).toContain('.byte');
    });

    it('has at least 15 directives', () => {
        expect(DIRECTIVES.length).toBeGreaterThanOrEqual(15);
    });

    it('all start with dot', () => {
        for (const d of DIRECTIVES) {
            expect(d.startsWith('.')).toBe(true);
        }
    });
});

// ─── getOpcodeCompletionItems ──────────────────────────────────────────────

describe('getOpcodeCompletionItems', () => {
    it('returns items for all opcodes', () => {
        const items = getOpcodeCompletionItems();
        expect(items.length).toBe(OPCODE_DATABASE.size);
    });

    it('each item has required LSP fields', () => {
        const items = getOpcodeCompletionItems();
        for (const item of items) {
            expect(item.label).toBeTruthy();
            expect(item.kind).toBeDefined();
            expect(item.detail).toBeTruthy();
            expect(item.documentation).toBeTruthy();
            expect(item.insertText).toBeTruthy();
        }
    });

    it('items include HALT and NOP', () => {
        const items = getOpcodeCompletionItems();
        const labels = items.map(i => i.label);
        expect(labels).toContain('HALT');
        expect(labels).toContain('NOP');
    });
});

// ─── getRegisterCompletionItems ────────────────────────────────────────────

describe('getRegisterCompletionItems', () => {
    it('returns 53 register items', () => {
        const items = getRegisterCompletionItems();
        expect(items.length).toBe(53);
    });

    it('includes all register names', () => {
        const items = getRegisterCompletionItems();
        const labels = items.map(i => i.label);
        for (const reg of ALL_REGISTERS) {
            expect(labels).toContain(reg);
        }
    });

    it('GP registers have integer register detail', () => {
        const items = getRegisterCompletionItems();
        const r0 = items.find(i => i.label === 'R0');
        expect(r0).toBeDefined();
        expect(r0!.detail).toContain('General-purpose');
    });

    it('special registers have special register kind', () => {
        const items = getRegisterCompletionItems();
        const sp = items.find(i => i.label === 'SP');
        expect(sp).toBeDefined();
        expect(sp!.detail).toContain('Special');
    });
});

// ─── getDirectiveCompletionItems ───────────────────────────────────────────

describe('getDirectiveCompletionItems', () => {
    it('returns items for all directives', () => {
        const items = getDirectiveCompletionItems();
        expect(items.length).toBe(DIRECTIVES.length);
    });

    it('each item is a keyword kind', () => {
        const items = getDirectiveCompletionItems();
        for (const item of items) {
            expect(item.kind).toBe(14); // CompletionItemKind.Keyword
        }
    });
});
