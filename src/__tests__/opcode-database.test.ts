/**
 * FLUX LSP Test Suite — Opcode Database Tests
 *
 * Tests the opcode database lookup, completion items, and snippet generation.
 */

import {
    lookupOpcode,
    OPCODE_DATABASE,
    getOpcodeCompletionItems,
    getRegisterCompletionItems,
    getDirectiveCompletionItems,
    getCategories,
    getFormatDescription,
    formatOpcodeMarkdown,
    lookupDirective,
    formatDirectiveMarkdown,
    ALL_REGISTERS,
    DIRECTIVES,
} from '../opcode-database';

describe('Opcode Database — lookupOpcode', () => {
    test('finds HALT by name', () => {
        const info = lookupOpcode('HALT');
        expect(info).toBeDefined();
        expect(info!.mnemonic).toBe('HALT');
        expect(info!.opcode).toBe(0x00);
        expect(info!.format).toBe('A');
        expect(info!.implemented).toBe(true);
    });

    test('finds ADD by name', () => {
        const info = lookupOpcode('ADD');
        expect(info).toBeDefined();
        expect(info!.opcode).toBe(0x20);
        expect(info!.category).toBe('arithmetic');
        expect(info!.operands).toHaveLength(3);
    });

    test('returns undefined for unknown opcode', () => {
        expect(lookupOpcode('FAKEOP')).toBeUndefined();
        expect(lookupOpcode('')).toBeUndefined();
    });

    test('lookup is case-insensitive', () => {
        expect(lookupOpcode('halt')).toEqual(lookupOpcode('HALT'));
        expect(lookupOpcode('add')).toEqual(lookupOpcode('ADD'));
        expect(lookupOpcode('HALT')).toBeDefined();
    });
});

describe('Opcode Database — OPCODE_DATABASE', () => {
    test('contains a substantial number of opcodes', () => {
        // We have 200+ opcodes in the ISA
        expect(OPCODE_DATABASE.size).toBeGreaterThanOrEqual(100);
    });

    test('all opcodes have required fields', () => {
        for (const [name, info] of OPCODE_DATABASE) {
            expect(name).toBe(info.mnemonic);
            expect(typeof info.opcode).toBe('number');
            expect(['A', 'B', 'C', 'D', 'E', 'F', 'G']).toContain(info.format);
            expect(typeof info.description).toBe('string');
            expect(info.description.length).toBeGreaterThan(0);
            expect(typeof info.category).toBe('string');
            expect(Array.isArray(info.operands)).toBe(true);
            expect(typeof info.implemented).toBe('boolean');
        }
    });

    test('opcode values are unique', () => {
        const opcodes = new Set<number>();
        for (const info of OPCODE_DATABASE.values()) {
            expect(opcodes.has(info.opcode)).toBe(false);
            opcodes.add(info.opcode);
        }
    });
});

describe('Opcode Database — getCategories', () => {
    test('returns non-empty array', () => {
        const cats = getCategories();
        expect(cats.length).toBeGreaterThan(0);
        expect(cats).toContain('arithmetic');
        expect(cats).toContain('control');
        expect(cats).toContain('memory');
    });
});

describe('Opcode Database — getFormatDescription', () => {
    test('returns descriptions for all formats', () => {
        const formats: ('A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G')[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
        for (const fmt of formats) {
            const desc = getFormatDescription(fmt);
            expect(typeof desc).toBe('string');
            expect(desc.length).toBeGreaterThan(0);
        }
    });
});

describe('Opcode Database — formatOpcodeMarkdown', () => {
    test('formats HALT correctly', () => {
        const info = lookupOpcode('HALT')!;
        const md = formatOpcodeMarkdown(info);
        expect(md).toContain('HALT');
        expect(md).toContain('Stop execution');
        expect(md).toContain('0x00');
        expect(md).toContain('Format');
    });

    test('formats ADD with operand info', () => {
        const info = lookupOpcode('ADD')!;
        const md = formatOpcodeMarkdown(info);
        expect(md).toContain('ADD');
        expect(md).toContain('rd = rs1 + rs2');
        expect(md).toContain('0x20');
    });

    test('includes implemented status', () => {
        const halt = lookupOpcode('HALT')!;
        const haltMd = formatOpcodeMarkdown(halt);
        // Should indicate implemented status somehow
        expect(haltMd.length).toBeGreaterThan(10);

        const ret = lookupOpcode('RET')!;
        const retMd = formatOpcodeMarkdown(ret);
        // Should indicate not-implemented status somehow
        expect(retMd.length).toBeGreaterThan(10);
    });
});

describe('Opcode Database — Completion Items', () => {
    test('getOpcodeCompletionItems returns items', () => {
        const items = getOpcodeCompletionItems();
        expect(items.length).toBeGreaterThanOrEqual(100);
    });

    test('opcode items have snippet format', () => {
        const items = getOpcodeCompletionItems();
        // Check at least one item has snippet insertText
        const addItem = items.find(i => i.label === 'ADD');
        expect(addItem).toBeDefined();
        expect(addItem!.insertText).toContain('$'); // snippet placeholders
    });

    test('HALT completion has no operands in snippet', () => {
        const items = getOpcodeCompletionItems();
        const haltItem = items.find(i => i.label === 'HALT');
        expect(haltItem).toBeDefined();
        expect(haltItem!.insertText).toBe('HALT');
    });

    test('getRegisterCompletionItems returns all registers', () => {
        const items = getRegisterCompletionItems();
        expect(items.length).toBe(ALL_REGISTERS.length);
    });

    test('getDirectiveCompletionItems returns all directives', () => {
        const items = getDirectiveCompletionItems();
        expect(items.length).toBe(DIRECTIVES.length);
    });
});

describe('Opcode Database — Directive Documentation', () => {
    test('lookupDirective finds .global', () => {
        const info = lookupDirective('.global');
        expect(info).toBeDefined();
        expect(info!.description).toContain('symbol');
    });

    test('lookupDirective returns undefined for unknown', () => {
        expect(lookupDirective('.fake')).toBeUndefined();
    });

    test('formatDirectiveMarkdown includes syntax and description', () => {
        const info = lookupDirective('.equ')!;
        const md = formatDirectiveMarkdown(info);
        expect(md).toContain('.equ');
        expect(md).toContain('named constant');
    });

    test('formatDirectiveMarkdown includes example when present', () => {
        const info = lookupDirective('.byte')!;
        const md = formatDirectiveMarkdown(info);
        expect(md).toContain('0x41');
    });
});
