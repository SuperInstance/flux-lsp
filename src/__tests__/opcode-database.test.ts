/**
 * Opcode Database Tests — FLUX ISA Opcode Reference
 *
 * Tests the opcode database: lookup, categories, registers, completion items, etc.
 */

import {
    lookupOpcode,
    getOpcodesByCategory,
    getCategories,
    getFormatDescription,
    formatOpcodeMarkdown,
    OPCODE_DATABASE,
    GP_REGISTERS,
    FP_REGISTERS,
    VEC_REGISTERS,
    SPECIAL_REGISTERS,
    ALL_REGISTERS,
    DIRECTIVES,
    getOpcodeCompletionItems,
    getRegisterCompletionItems,
    getDirectiveCompletionItems,
} from '../opcode-database';

// ═══════════════════════════════════════════════════════════════════════════════
// OPCODE_DATABASE Map
// ═══════════════════════════════════════════════════════════════════════════════

describe('OPCODE_DATABASE', () => {
    test('is a Map', () => {
        expect(OPCODE_DATABASE).toBeInstanceOf(Map);
    });

    test('has a substantial number of opcodes (at least 50)', () => {
        expect(OPCODE_DATABASE.size).toBeGreaterThanOrEqual(50);
    });

    test('contains core system opcodes', () => {
        expect(OPCODE_DATABASE.has('HALT')).toBe(true);
        expect(OPCODE_DATABASE.has('NOP')).toBe(true);
        expect(OPCODE_DATABASE.has('RET')).toBe(true);
    });

    test('contains arithmetic opcodes', () => {
        expect(OPCODE_DATABASE.has('ADD')).toBe(true);
        expect(OPCODE_DATABASE.has('SUB')).toBe(true);
        expect(OPCODE_DATABASE.has('MUL')).toBe(true);
        expect(OPCODE_DATABASE.has('DIV')).toBe(true);
    });

    test('contains logic opcodes', () => {
        expect(OPCODE_DATABASE.has('AND')).toBe(true);
        expect(OPCODE_DATABASE.has('OR')).toBe(true);
        expect(OPCODE_DATABASE.has('XOR')).toBe(true);
    });

    test('contains memory opcodes', () => {
        expect(OPCODE_DATABASE.has('LOAD')).toBe(true);
        expect(OPCODE_DATABASE.has('STORE')).toBe(true);
    });

    test('contains control flow opcodes', () => {
        expect(OPCODE_DATABASE.has('JMP')).toBe(true);
        expect(OPCODE_DATABASE.has('JAL')).toBe(true);
        expect(OPCODE_DATABASE.has('JZ')).toBe(true);
        expect(OPCODE_DATABASE.has('CALL')).toBe(true);
    });

    test('contains confidence opcodes', () => {
        expect(OPCODE_DATABASE.has('CONF_LD')).toBe(true);
        expect(OPCODE_DATABASE.has('CONF_ST')).toBe(true);
        expect(OPCODE_DATABASE.has('C_ADD')).toBe(true);
    });

    test('contains viewpoint opcodes', () => {
        expect(OPCODE_DATABASE.has('V_EVID')).toBe(true);
        expect(OPCODE_DATABASE.has('V_MODAL')).toBe(true);
    });

    test('contains a2a opcodes', () => {
        expect(OPCODE_DATABASE.has('TELL')).toBe(true);
        expect(OPCODE_DATABASE.has('ASK')).toBe(true);
        expect(OPCODE_DATABASE.has('DELEG')).toBe(true);
    });

    test('all opcodes have uppercase mnemonics', () => {
        for (const [mnemonic] of OPCODE_DATABASE) {
            expect(mnemonic).toEqual(mnemonic.toUpperCase());
        }
    });

    test('all opcodes have valid formats (A-G)', () => {
        const validFormats = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
        for (const [, info] of OPCODE_DATABASE) {
            expect(validFormats).toContain(info.format);
        }
    });

    test('all opcodes have non-empty descriptions', () => {
        for (const [, info] of OPCODE_DATABASE) {
            expect(info.description.length).toBeGreaterThan(0);
        }
    });

    test('all opcodes have non-empty categories', () => {
        for (const [, info] of OPCODE_DATABASE) {
            expect(info.category.length).toBeGreaterThan(0);
        }
    });

    test('all opcodes have implemented field as boolean', () => {
        for (const [, info] of OPCODE_DATABASE) {
            expect(typeof info.implemented).toBe('boolean');
        }
    });

    test('all opcodes have non-negative opcode numbers', () => {
        for (const [, info] of OPCODE_DATABASE) {
            expect(info.opcode).toBeGreaterThanOrEqual(0);
        }
    });

    test('all opcodes have operands as an array', () => {
        for (const [, info] of OPCODE_DATABASE) {
            expect(Array.isArray(info.operands)).toBe(true);
        }
    });

    test('all operand roles are valid', () => {
        const validRoles = ['rd', 'rs1', 'rs2', 'imm8', 'imm16', '-'];
        for (const [, info] of OPCODE_DATABASE) {
            for (const op of info.operands) {
                expect(validRoles).toContain(op.role);
            }
        }
    });

    test('no duplicate opcode numbers', () => {
        const opcodes = new Set<number>();
        for (const [, info] of OPCODE_DATABASE) {
            expect(opcodes.has(info.opcode)).toBe(false);
            opcodes.add(info.opcode);
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// lookupOpcode
// ═══════════════════════════════════════════════════════════════════════════════

describe('lookupOpcode', () => {
    test('finds HALT by uppercase', () => {
        const info = lookupOpcode('HALT');
        expect(info).toBeDefined();
        expect(info!.mnemonic).toBe('HALT');
        expect(info!.opcode).toBe(0x00);
        expect(info!.format).toBe('A');
    });

    test('finds opcode by lowercase input', () => {
        const info = lookupOpcode('add');
        expect(info).toBeDefined();
        expect(info!.mnemonic).toBe('ADD');
    });

    test('finds opcode by mixed case', () => {
        const info = lookupOpcode('HaLt');
        expect(info).toBeDefined();
        expect(info!.mnemonic).toBe('HALT');
    });

    test('returns undefined for unknown opcode', () => {
        const info = lookupOpcode('NONEXISTENT');
        expect(info).toBeUndefined();
    });

    test('returns undefined for empty string', () => {
        const info = lookupOpcode('');
        expect(info).toBeUndefined();
    });

    test('ADD has correct opcode number', () => {
        const info = lookupOpcode('ADD');
        expect(info!.opcode).toBe(0x20);
        expect(info!.format).toBe('E');
        expect(info!.category).toBe('arithmetic');
    });

    test('LOAD has correct operands', () => {
        const info = lookupOpcode('LOAD');
        expect(info!.operands).toHaveLength(3);
        expect(info!.operands[0].role).toBe('rd');
        expect(info!.operands[1].role).toBe('rs1');
        expect(info!.operands[2].role).toBe('rs2');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getOpcodesByCategory
// ═══════════════════════════════════════════════════════════════════════════════

describe('getOpcodesByCategory', () => {
    test('returns arithmetic opcodes', () => {
        const ops = getOpcodesByCategory('arithmetic');
        expect(ops.length).toBeGreaterThanOrEqual(4);
        const names = ops.map(o => o.mnemonic);
        expect(names).toContain('ADD');
        expect(names).toContain('SUB');
    });

    test('returns empty array for unknown category', () => {
        const ops = getOpcodesByCategory('nonexistent_category');
        expect(ops).toHaveLength(0);
    });

    test('returns control flow opcodes', () => {
        const ops = getOpcodesByCategory('control');
        expect(ops.length).toBeGreaterThanOrEqual(4);
        const names = ops.map(o => o.mnemonic);
        expect(names).toContain('JMP');
        expect(names).toContain('JZ');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getCategories
// ═══════════════════════════════════════════════════════════════════════════════

describe('getCategories', () => {
    test('returns array of category strings', () => {
        const cats = getCategories();
        expect(Array.isArray(cats)).toBe(true);
        expect(cats.length).toBeGreaterThanOrEqual(5);
    });

    test('includes common categories', () => {
        const cats = getCategories();
        expect(cats).toContain('system');
        expect(cats).toContain('arithmetic');
        expect(cats).toContain('memory');
        expect(cats).toContain('control');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getFormatDescription
// ═══════════════════════════════════════════════════════════════════════════════

describe('getFormatDescription', () => {
    test('returns description for format A', () => {
        const desc = getFormatDescription('A');
        expect(typeof desc).toBe('string');
        expect(desc.length).toBeGreaterThan(0);
    });

    test('returns description for all formats A-G', () => {
        for (const fmt of ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const) {
            const desc = getFormatDescription(fmt);
            expect(typeof desc).toBe('string');
            expect(desc.length).toBeGreaterThan(0);
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// formatOpcodeMarkdown
// ═══════════════════════════════════════════════════════════════════════════════

describe('formatOpcodeMarkdown', () => {
    test('returns markdown string for HALT', () => {
        const info = lookupOpcode('HALT')!;
        const md = formatOpcodeMarkdown(info);
        expect(md).toContain('HALT');
        expect(md).toContain('Stop execution');
        expect(md).toContain('Format');
    });

    test('includes mnemonic in bold', () => {
        const info = lookupOpcode('ADD')!;
        const md = formatOpcodeMarkdown(info);
        expect(md).toContain('**ADD**');
    });

    test('includes description', () => {
        const info = lookupOpcode('MOVI')!;
        const md = formatOpcodeMarkdown(info);
        expect(md).toContain('rd = sign_extend(imm8)');
    });

    test('includes format description', () => {
        const info = lookupOpcode('ADD')!;
        const md = formatOpcodeMarkdown(info);
        expect(md).toContain('Format **E**');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Register Constants
// ═══════════════════════════════════════════════════════════════════════════════

describe('register constants', () => {
    test('GP_REGISTERS has R0-R15', () => {
        expect(GP_REGISTERS).toHaveLength(16);
        expect(GP_REGISTERS[0]).toBe('R0');
        expect(GP_REGISTERS[15]).toBe('R15');
    });

    test('FP_REGISTERS has F0-F15', () => {
        expect(FP_REGISTERS).toHaveLength(16);
        expect(FP_REGISTERS[0]).toBe('F0');
        expect(FP_REGISTERS[15]).toBe('F15');
    });

    test('VEC_REGISTERS has V0-V15', () => {
        expect(VEC_REGISTERS).toHaveLength(16);
        expect(VEC_REGISTERS[0]).toBe('V0');
        expect(VEC_REGISTERS[15]).toBe('V15');
    });

    test('SPECIAL_REGISTERS has expected entries', () => {
        expect(SPECIAL_REGISTERS).toContain('SP');
        expect(SPECIAL_REGISTERS).toContain('FP');
        expect(SPECIAL_REGISTERS).toContain('LR');
        expect(SPECIAL_REGISTERS).toContain('PC');
        expect(SPECIAL_REGISTERS).toContain('FLAGS');
    });

    test('ALL_REGISTERS combines all register types', () => {
        expect(ALL_REGISTERS.length).toBe(16 + 16 + 16 + 5); // GP + FP + VEC + SPECIAL
        expect(ALL_REGISTERS).toContain('R0');
        expect(ALL_REGISTERS).toContain('F0');
        expect(ALL_REGISTERS).toContain('V0');
        expect(ALL_REGISTERS).toContain('SP');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DIRECTIVES
// ═══════════════════════════════════════════════════════════════════════════════

describe('DIRECTIVES', () => {
    test('is a non-empty array', () => {
        expect(DIRECTIVES.length).toBeGreaterThan(0);
    });

    test('contains common directives', () => {
        expect(DIRECTIVES).toContain('.text');
        expect(DIRECTIVES).toContain('.data');
        expect(DIRECTIVES).toContain('.global');
    });

    test('all directives start with dot', () => {
        for (const d of DIRECTIVES) {
            expect(d.startsWith('.')).toBe(true);
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Completion Items
// ═══════════════════════════════════════════════════════════════════════════════

describe('getOpcodeCompletionItems', () => {
    test('returns items for all opcodes in database', () => {
        const items = getOpcodeCompletionItems();
        expect(items.length).toBe(OPCODE_DATABASE.size);
    });

    test('each item has a label matching mnemonic', () => {
        const items = getOpcodeCompletionItems();
        for (const item of items) {
            expect(OPCODE_DATABASE.has(item.label)).toBe(true);
        }
    });

    test('items have detail strings', () => {
        const items = getOpcodeCompletionItems();
        for (const item of items) {
            expect(item.detail).toBeDefined();
            expect(item.detail!.length).toBeGreaterThan(0);
        }
    });

    test('items have insertText', () => {
        const items = getOpcodeCompletionItems();
        for (const item of items) {
            expect(item.insertText).toBeDefined();
        }
    });
});

describe('getRegisterCompletionItems', () => {
    test('returns items for all registers', () => {
        const items = getRegisterCompletionItems();
        expect(items.length).toBe(ALL_REGISTERS.length);
    });

    test('each item has label matching register name', () => {
        const items = getRegisterCompletionItems();
        const labels = items.map(i => i.label);
        for (const reg of ALL_REGISTERS) {
            expect(labels).toContain(reg);
        }
    });
});

describe('getDirectiveCompletionItems', () => {
    test('returns items for all directives', () => {
        const items = getDirectiveCompletionItems();
        expect(items.length).toBe(DIRECTIVES.length);
    });

    test('each item has label matching directive', () => {
        const items = getDirectiveCompletionItems();
        const labels = items.map(i => i.label);
        for (const d of DIRECTIVES) {
            expect(labels).toContain(d);
        }
    });
});
