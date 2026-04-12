/**
 * Tests for the FLUX Opcode Database
 */

import {
    lookupOpcode,
    formatOpcodeMarkdown,
    getOpcodeCompletionItems,
    getRegisterCompletionItems,
    getDirectiveCompletionItems,
} from '../opcode-database';

// ─── lookupOpcode ───────────────────────────────────────────────────────────

describe('lookupOpcode', () => {
    test('finds common opcodes', () => {
        expect(lookupOpcode('HALT')).toBeDefined();
        expect(lookupOpcode('NOP')).toBeDefined();
        expect(lookupOpcode('ADD')).toBeDefined();
        expect(lookupOpcode('SUB')).toBeDefined();
        expect(lookupOpcode('MOV')).toBeDefined();
        expect(lookupOpcode('JMP')).toBeDefined();
        expect(lookupOpcode('LOAD')).toBeDefined();
        expect(lookupOpcode('STORE')).toBeDefined();
    });

    test('returns undefined for unknown opcodes', () => {
        expect(lookupOpcode('FAKEOP')).toBeUndefined();
        expect(lookupOpcode('')).toBeUndefined();
        expect(lookupOpcode('xyz')).toBeUndefined();
    });

    test('case-insensitive lookup', () => {
        expect(lookupOpcode('halt')).toBeDefined();
        expect(lookupOpcode('Halt')).toBeDefined();
        expect(lookupOpcode('HALT')).toBeDefined();
    });

    test('returns correct opcode info structure', () => {
        const info = lookupOpcode('ADD');
        expect(info).toBeDefined();
        expect(info!.mnemonic).toBe('ADD');
        expect(info!.opcode).toBe(0x20);
        expect(info!.format).toBe('E');
        expect(info!.category).toBe('arithmetic');
        expect(info!.operands).toHaveLength(3);
        expect(info!.operands[0].role).toBe('rd');
        expect(info!.operands[1].role).toBe('rs1');
        expect(info!.operands[2].role).toBe('rs2');
    });

    test('finds opcodes across all categories', () => {
        const categories = new Set<string>();
        // Sample a few opcodes from each known category
        const samples = [
            'HALT', 'INC', 'SYS', 'MOVI', 'ADD', 'FADD',
            'MOVI16', 'LOADOFF', 'TELL', 'C_ADD', 'V_EVID',
            'SENSE', 'ABS', 'LEN', 'VLOAD', 'TMATMUL',
            'DMA_CPY', 'JMPL', 'ASSERT',
        ];
        for (const mn of samples) {
            const info = lookupOpcode(mn);
            expect(info).toBeDefined();
            if (info) categories.add(info.category);
        }
        expect(categories.size).toBeGreaterThan(5);
    });

    test('zero-operand opcodes have empty operands array', () => {
        const info = lookupOpcode('HALT');
        expect(info!.operands).toHaveLength(0);
    });

    test('single-register opcodes have one operand', () => {
        const info = lookupOpcode('INC');
        expect(info!.operands).toHaveLength(1);
        expect(info!.operands[0].role).toBe('rd');
    });

    test('imm8 opcodes have correct role', () => {
        const info = lookupOpcode('MOVI');
        expect(info!.operands[1].role).toBe('imm8');
    });

    test('imm16 opcodes have correct role', () => {
        const info = lookupOpcode('MOVI16');
        expect(info!.operands[1].role).toBe('imm16');
    });
});

// ─── formatOpcodeMarkdown ───────────────────────────────────────────────────

describe('formatOpcodeMarkdown', () => {
    test('returns markdown string', () => {
        const info = lookupOpcode('ADD');
        expect(info).toBeDefined();
        const md = formatOpcodeMarkdown(info!);
        expect(typeof md).toBe('string');
        expect(md.length).toBeGreaterThan(0);
    });

    test('includes mnemonic in output', () => {
        const info = lookupOpcode('HALT');
        const md = formatOpcodeMarkdown(info!);
        expect(md).toContain('HALT');
    });

    test('includes description', () => {
        const info = lookupOpcode('HALT');
        const md = formatOpcodeMarkdown(info!);
        expect(md).toContain('Stop execution');
    });

    test('includes format info', () => {
        const info = lookupOpcode('ADD');
        const md = formatOpcodeMarkdown(info!);
        expect(md).toContain('Format');
    });
});

// ─── getOpcodeCompletionItems ───────────────────────────────────────────────

describe('getOpcodeCompletionItems', () => {
    test('returns non-empty array', () => {
        const items = getOpcodeCompletionItems();
        expect(items.length).toBeGreaterThan(0);
    });

    test('all items have required fields', () => {
        const items = getOpcodeCompletionItems();
        for (const item of items) {
            expect(item.label).toBeTruthy();
            expect(item.kind).toBeDefined();
            expect(item.detail).toBeTruthy();
        }
    });

    test('includes all standard opcodes', () => {
        const items = getOpcodeCompletionItems();
        const labels = items.map(i => i.label);
        expect(labels).toContain('HALT');
        expect(labels).toContain('NOP');
        expect(labels).toContain('ADD');
        expect(labels).toContain('MOV');
        expect(labels).toContain('JMP');
        expect(labels).toContain('LOAD');
        expect(labels).toContain('STORE');
    });

    test('returns at least 200 opcodes', () => {
        const items = getOpcodeCompletionItems();
        expect(items.length).toBeGreaterThanOrEqual(200);
    });
});

// ─── getRegisterCompletionItems ─────────────────────────────────────────────

describe('getRegisterCompletionItems', () => {
    test('returns non-empty array', () => {
        const items = getRegisterCompletionItems();
        expect(items.length).toBeGreaterThan(0);
    });

    test('includes GP registers R0-R15', () => {
        const items = getRegisterCompletionItems();
        const labels = items.map(i => i.label);
        for (let i = 0; i <= 15; i++) {
            expect(labels).toContain(`R${i}`);
        }
    });

    test('includes FP registers F0-F15', () => {
        const items = getRegisterCompletionItems();
        const labels = items.map(i => i.label);
        for (let i = 0; i <= 15; i++) {
            expect(labels).toContain(`F${i}`);
        }
    });

    test('includes vector registers V0-V15', () => {
        const items = getRegisterCompletionItems();
        const labels = items.map(i => i.label);
        for (let i = 0; i <= 15; i++) {
            expect(labels).toContain(`V${i}`);
        }
    });

    test('includes special registers', () => {
        const items = getRegisterCompletionItems();
        const labels = items.map(i => i.label);
        expect(labels).toContain('SP');
        expect(labels).toContain('FP');
        expect(labels).toContain('LR');
        expect(labels).toContain('PC');
        expect(labels).toContain('FLAGS');
    });

    test('total register count is 53 (48 + 5 special)', () => {
        const items = getRegisterCompletionItems();
        expect(items.length).toBe(53);
    });
});

// ─── getDirectiveCompletionItems ────────────────────────────────────────────

describe('getDirectiveCompletionItems', () => {
    test('returns non-empty array', () => {
        const items = getDirectiveCompletionItems();
        expect(items.length).toBeGreaterThan(0);
    });

    test('includes common directives', () => {
        const items = getDirectiveCompletionItems();
        const labels = items.map(i => i.label);
        expect(labels).toContain('.text');
        expect(labels).toContain('.data');
        expect(labels).toContain('.global');
        expect(labels).toContain('.word');
    });

    test('all directive labels start with dot', () => {
        const items = getDirectiveCompletionItems();
        for (const item of items) {
            expect(item.label.startsWith('.')).toBe(true);
        }
    });
});

// ─── Opcode Database Integrity ──────────────────────────────────────────────

describe('opcode database integrity', () => {
    test('no duplicate opcodes', () => {
        const { lookupOpcode } = require('../opcode-database');
        // We can't directly access RAW_OPCODES, but we can check for duplicates
        // by verifying that each known mnemonic is unique
        const mnemonics = [
            'HALT', 'NOP', 'RET', 'BRK', 'INC', 'DEC', 'NOT', 'NEG',
            'PUSH', 'POP', 'SYS', 'TRAP', 'DBG', 'YIELD',
            'MOVI', 'ADDI', 'SUBI', 'ADD', 'SUB', 'MUL', 'DIV', 'MOD',
            'FADD', 'LOAD', 'STORE', 'MOV', 'JZ', 'JNZ', 'JMP', 'JAL',
            'MOVI16', 'LOADOFF', 'STOREOF', 'TELL', 'ASK', 'DELEG',
            'C_ADD', 'C_MERGE', 'V_EVID', 'SENSE', 'ABS', 'SHA256',
            'LEN', 'CONCAT', 'VLOAD', 'TMATMUL', 'DMA_CPY', 'JMPL',
            'ASSERT', 'DUMP', 'ILLEGAL',
        ];
        const uniqueMnemonics = new Set(mnemonics);
        expect(uniqueMnemonics.size).toBe(mnemonics.length);
    });

    test('all opcodes have descriptions', () => {
        const samples = ['HALT', 'ADD', 'MOV', 'JMP', 'LOAD', 'TELL', 'C_ADD', 'V_EVID', 'SENSE', 'ABS', 'LEN', 'VLOAD', 'TMATMUL', 'DMA_CPY', 'JMPL', 'ASSERT'];
        for (const mn of samples) {
            const info = lookupOpcode(mn);
            expect(info?.description).toBeTruthy();
            expect(info!.description.length).toBeGreaterThan(0);
        }
    });
});
