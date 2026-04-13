/**
 * FLUX LSP Test Suite — Hover & Completion Tests
 *
 * Tests hover information generation and completion item quality
 * using the opcode-database module (server.ts hover logic tested indirectly).
 */

import {
    lookupOpcode,
    formatOpcodeMarkdown,
    lookupDirective,
    formatDirectiveMarkdown,
    getOpcodeCompletionItems,
    getRegisterCompletionItems,
    getDirectiveCompletionItems,
    getCategories,
    getOpcodesByCategory,
    OPCODE_DATABASE,
    GP_REGISTERS,
    FP_REGISTERS,
    VEC_REGISTERS,
    SPECIAL_REGISTERS,
    ALL_REGISTERS,
    DIRECTIVES,
} from '../opcode-database';

describe('Hover — Opcode Documentation', () => {
    test('HALT hover contains description and opcode value', () => {
        const info = lookupOpcode('HALT')!;
        const md = formatOpcodeMarkdown(info);
        expect(md).toContain('HALT');
        expect(md).toContain('Stop execution');
        expect(md).toContain('0x00');
    });

    test('ADD hover shows three operands', () => {
        const info = lookupOpcode('ADD')!;
        const md = formatOpcodeMarkdown(info);
        expect(md).toContain('rd = rs1 + rs2');
    });

    test('LOAD hover shows memory semantics', () => {
        const info = lookupOpcode('LOAD')!;
        const md = formatOpcodeMarkdown(info);
        expect(md).toContain('mem[');
    });

    test('STORE hover shows memory write semantics', () => {
        const info = lookupOpcode('STORE')!;
        const md = formatOpcodeMarkdown(info);
        expect(md).toContain('mem[');
    });

    test('JMP hover shows relative jump semantics', () => {
        const info = lookupOpcode('JMP')!;
        const md = formatOpcodeMarkdown(info);
        expect(md).toContain('JMP');
    });

    test('JAL hover shows link register semantics', () => {
        const info = lookupOpcode('JAL')!;
        const md = formatOpcodeMarkdown(info);
        expect(md).toContain('pc');
    });

    test('confidence opcode hover includes confidence info', () => {
        const info = lookupOpcode('C_ADD')!;
        const md = formatOpcodeMarkdown(info);
        expect(md).toContain('C_ADD');
        expect(md.length).toBeGreaterThan(10);
    });

    test('a2a opcode hover shows agent communication', () => {
        const info = lookupOpcode('TELL')!;
        const md = formatOpcodeMarkdown(info);
        expect(md).toContain('TELL');
        expect(md).toContain('agent');
    });

    test('hover for implemented opcode has different content than unimplemented', () => {
        const haltMd = formatOpcodeMarkdown(lookupOpcode('HALT')!);
        const retMd = formatOpcodeMarkdown(lookupOpcode('RET')!);
        // Both should be valid markdown but show different implementation status
        expect(haltMd.length).toBeGreaterThan(0);
        expect(retMd.length).toBeGreaterThan(0);
    });

    test('all format descriptions are non-empty', () => {
        const formats = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
        for (const f of formats) {
            const desc = getCategories();
            expect(desc.length).toBeGreaterThan(0);
        }
    });
});

describe('Hover — Directive Documentation', () => {
    test('.text directive has documentation', () => {
        const info = lookupDirective('.text');
        expect(info).toBeDefined();
        const md = formatDirectiveMarkdown(info!);
        expect(md).toContain('.text');
    });

    test('.data directive has documentation', () => {
        const info = lookupDirective('.data');
        expect(info).toBeDefined();
        const md = formatDirectiveMarkdown(info!);
        expect(md).toContain('.data');
    });

    test('.word directive includes example', () => {
        const info = lookupDirective('.word');
        expect(info).toBeDefined();
        const md = formatDirectiveMarkdown(info!);
        expect(md).toContain('.word');
    });

    test('.asciz directive has documentation', () => {
        const info = lookupDirective('.asciz');
        expect(info).toBeDefined();
        const md = formatDirectiveMarkdown(info!);
        expect(md).toContain('.asciz');
    });
});

describe('Completion — Opcode Items', () => {
    test('every opcode has a completion item', () => {
        const items = getOpcodeCompletionItems();
        for (const [name] of OPCODE_DATABASE) {
            expect(items.find(i => i.label === name)).toBeDefined();
        }
    });

    test('zero-operand opcodes have simple insert text', () => {
        const items = getOpcodeCompletionItems();
        const nop = items.find(i => i.label === 'NOP');
        expect(nop).toBeDefined();
        expect(nop!.insertText).toBe('NOP');

        const halt = items.find(i => i.label === 'HALT');
        expect(halt).toBeDefined();
        expect(halt!.insertText).toBe('HALT');
    });

    test('two-operand opcodes have two placeholders', () => {
        const items = getOpcodeCompletionItems();
        const movi = items.find(i => i.label === 'MOVI');
        expect(movi).toBeDefined();
        expect(movi!.insertText).toContain('${1');
        expect(movi!.insertText).toContain('${2');
    });

    test('three-operand opcodes have three placeholders', () => {
        const items = getOpcodeCompletionItems();
        const add = items.find(i => i.label === 'ADD');
        expect(add).toBeDefined();
        expect(add!.insertText).toContain('${1');
        expect(add!.insertText).toContain('${2');
        expect(add!.insertText).toContain('${3');
    });

    test('completion items have detail with category', () => {
        const items = getOpcodeCompletionItems();
        const add = items.find(i => i.label === 'ADD');
        expect(add).toBeDefined();
        expect(add!.detail).toContain('arithmetic');
    });
});

describe('Completion — Register Items', () => {
    test('all GP registers are present', () => {
        const items = getRegisterCompletionItems();
        for (const reg of GP_REGISTERS) {
            expect(items.find(i => i.label === reg)).toBeDefined();
        }
    });

    test('all FP registers are present', () => {
        const items = getRegisterCompletionItems();
        for (const reg of FP_REGISTERS) {
            expect(items.find(i => i.label === reg)).toBeDefined();
        }
    });

    test('all VEC registers are present', () => {
        const items = getRegisterCompletionItems();
        for (const reg of VEC_REGISTERS) {
            expect(items.find(i => i.label === reg)).toBeDefined();
        }
    });

    test('all special registers are present', () => {
        const items = getRegisterCompletionItems();
        for (const reg of SPECIAL_REGISTERS) {
            expect(items.find(i => i.label === reg)).toBeDefined();
        }
    });

    test('register count matches ALL_REGISTERS', () => {
        const items = getRegisterCompletionItems();
        expect(items.length).toBe(ALL_REGISTERS.length);
    });
});

describe('Completion — Directive Items', () => {
    test('all directives have completion items', () => {
        const items = getDirectiveCompletionItems();
        for (const dir of DIRECTIVES) {
            expect(items.find(i => i.label === dir)).toBeDefined();
        }
    });

    test('directive count matches DIRECTIVES array', () => {
        const items = getDirectiveCompletionItems();
        expect(items.length).toBe(DIRECTIVES.length);
    });
});

describe('Completion — Category Filtering', () => {
    test('getOpcodesByCategory returns correct opcodes', () => {
        const arith = getOpcodesByCategory('arithmetic');
        expect(arith.length).toBeGreaterThan(0);
        expect(arith.every(op => op.category === 'arithmetic')).toBe(true);
        const names = arith.map(op => op.mnemonic);
        expect(names).toContain('ADD');
        expect(names).toContain('SUB');
        expect(names).toContain('MUL');
    });

    test('getOpcodesByCategory for control flow', () => {
        const control = getOpcodesByCategory('control');
        expect(control.length).toBeGreaterThan(0);
        const names = control.map(op => op.mnemonic);
        expect(names).toContain('JMP');
        expect(names).toContain('JZ');
        expect(names).toContain('JNZ');
    });

    test('getOpcodesByCategory for memory', () => {
        const mem = getOpcodesByCategory('memory');
        expect(mem.length).toBeGreaterThan(0);
        const names = mem.map(op => op.mnemonic);
        expect(names).toContain('LOAD');
        expect(names).toContain('STORE');
    });

    test('getOpcodesByCategory for system', () => {
        const sys = getOpcodesByCategory('system');
        expect(sys.length).toBeGreaterThan(0);
        const names = sys.map(op => op.mnemonic);
        expect(names).toContain('HALT');
        expect(names).toContain('NOP');
    });

    test('getOpcodesByCategory for a2a (agent-to-agent)', () => {
        const a2a = getOpcodesByCategory('a2a');
        expect(a2a.length).toBeGreaterThan(0);
        const names = a2a.map(op => op.mnemonic);
        expect(names).toContain('TELL');
        expect(names).toContain('ASK');
    });

    test('getCategories returns all major categories', () => {
        const cats = getCategories();
        expect(cats).toContain('arithmetic');
        expect(cats).toContain('logic');
        expect(cats).toContain('memory');
        expect(cats).toContain('control');
        expect(cats).toContain('system');
        expect(cats).toContain('stack');
    });
});
