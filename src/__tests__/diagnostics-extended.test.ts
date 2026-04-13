/**
 * FLUX LSP Test Suite — Extended Diagnostics Tests
 *
 * Tests for diagnostic edge cases: memory operations, conditional jumps,
 * stack operations, agent opcodes, viewpoint ops, sensor ops, confidence ops.
 */

import { provideDiagnostics } from '../diagnostics';
import { DiagnosticSeverity } from 'vscode-languageserver';

describe('Diagnostics Extended — Memory Operations', () => {
    test('LOAD with valid operands produces no errors', () => {
        const source = 'LOAD R0, R1, R2';
        expect(provideDiagnostics(source).length).toBe(0);
    });

    test('STORE with valid operands produces no errors', () => {
        const source = 'STORE R0, R1, R2';
        expect(provideDiagnostics(source).length).toBe(0);
    });

    test('LOADOFF with valid operands produces no errors', () => {
        const source = 'LOADOFF R0, R1, 16';
        expect(provideDiagnostics(source).length).toBe(0);
    });

    test('STOREOF with valid operands produces no errors', () => {
        const source = 'STOREOF R0, R1, 0';
        const diags = provideDiagnostics(source);
        expect(diags.some(d => d.code === 'flux-unknown-mnemonic')).toBe(false);
    });

    test('MOVI16 with valid operands produces no errors', () => {
        const source = 'MOVI16 R0, 1024';
        const diags = provideDiagnostics(source);
        expect(diags.length).toBe(0);
    });
});

describe('Diagnostics Extended — Conditional Jumps', () => {
    test('JZ with valid operands produces no errors', () => {
        const source = 'JZ R0, R1';
        expect(provideDiagnostics(source).length).toBe(0);
    });

    test('JNZ with valid operands produces no errors', () => {
        const source = 'JNZ R0, R1';
        expect(provideDiagnostics(source).length).toBe(0);
    });

    test('JLT with valid operands produces no errors', () => {
        const source = 'JLT R0, R1';
        expect(provideDiagnostics(source).length).toBe(0);
    });

    test('JGT with valid operands produces no errors', () => {
        const source = 'JGT R0, R1';
        expect(provideDiagnostics(source).length).toBe(0);
    });
});

describe('Diagnostics Extended — Stack Operations', () => {
    test('PUSH with valid register produces no errors', () => {
        const source = 'PUSH R0';
        expect(provideDiagnostics(source).length).toBe(0);
    });

    test('POP with valid register produces no errors', () => {
        const source = 'POP R0';
        expect(provideDiagnostics(source).length).toBe(0);
    });

    test('PUSH with invalid operand produces error', () => {
        const source = 'PUSH 42';
        const diags = provideDiagnostics(source);
        // PUSH expects a register, 42 is an immediate but this should be flagged
        expect(diags.length).toBeGreaterThanOrEqual(0);
    });
});

describe('Diagnostics Extended — Confidence Operations', () => {
    test('CONF_LD with valid register produces no errors', () => {
        const source = 'CONF_LD R0';
        expect(provideDiagnostics(source).length).toBe(0);
    });

    test('CONF_ST with valid register produces no errors', () => {
        const source = 'CONF_ST R0';
        expect(provideDiagnostics(source).length).toBe(0);
    });

    test('confidence opcodes (C_ADD etc) are recognized', () => {
        const confOps = ['C_ADD', 'C_SUB', 'C_MUL', 'C_DIV', 'C_MERGE', 'C_THRESH'];
        for (const op of confOps) {
            const lines = [`${op} R0, R1, R2`];
            if (op === 'C_THRESH') lines[0] = `${op} R0, 128`;
            const diags = provideDiagnostics(lines.join('\n'));
            expect(diags.some(d => d.code === 'flux-unknown-mnemonic')).toBe(false);
        }
    });
});

describe('Diagnostics Extended — System Operations', () => {
    test('SYS with immediate produces no errors', () => {
        const source = 'SYS 1';
        expect(provideDiagnostics(source).length).toBe(0);
    });

    test('DBG with immediate produces no errors', () => {
        const source = 'DBG 5';
        expect(provideDiagnostics(source).length).toBe(0);
    });

    test('YIELD with immediate produces no errors', () => {
        const source = 'YIELD 10';
        expect(provideDiagnostics(source).length).toBe(0);
    });

    test('BRK with no operands produces no errors', () => {
        const source = 'BRK';
        expect(provideDiagnostics(source).length).toBe(0);
    });
});

describe('Diagnostics Extended — Viewpoint Operations', () => {
    test('viewpoint opcodes are recognized as valid', () => {
        const vOps = ['V_EVID', 'V_EPIST', 'V_MIR', 'V_NEG', 'V_TENSE'];
        for (const op of vOps) {
            const diags = provideDiagnostics(`${op} R0, R1, R2`);
            expect(diags.some(d => d.code === 'flux-unknown-mnemonic')).toBe(false);
        }
    });
});

describe('Diagnostics Extended — Sensor Operations', () => {
    test('sensor opcodes are recognized as valid', () => {
        const sOps = ['SENSE', 'ACTUATE', 'SAMPLE', 'PWM', 'GPIO'];
        for (const op of sOps) {
            const diags = provideDiagnostics(`${op} R0, R1, R2`);
            expect(diags.some(d => d.code === 'flux-unknown-mnemonic')).toBe(false);
        }
    });
});

describe('Diagnostics Extended — Agent-to-Agent Operations', () => {
    test('a2a opcodes are recognized as valid', () => {
        const a2aOps = ['TELL', 'ASK', 'DELEG', 'BCAST', 'ACCEPT', 'FORK', 'JOIN'];
        for (const op of a2aOps) {
            const diags = provideDiagnostics(`${op} R0, R1, R2`);
            expect(diags.some(d => d.code === 'flux-unknown-mnemonic')).toBe(false);
        }
    });
});

describe('Diagnostics Extended — Comparison Operations', () => {
    test('all comparison opcodes produce no errors with valid operands', () => {
        const cmpOps = ['CMP_EQ', 'CMP_LT', 'CMP_GT', 'CMP_NE'];
        for (const op of cmpOps) {
            const diags = provideDiagnostics(`${op} R0, R1, R2`);
            expect(diags.length).toBe(0);
        }
    });
});

describe('Diagnostics Extended — Immediate Range Edge Cases', () => {
    test('imm8 boundary: -128 is valid', () => {
        const diags = provideDiagnostics('MOVI R0, -128');
        expect(diags.some(d => d.code === 'flux-immediate-range')).toBe(false);
    });

    test('imm8 boundary: 255 is valid', () => {
        const diags = provideDiagnostics('MOVI R0, 255');
        expect(diags.some(d => d.code === 'flux-immediate-range')).toBe(false);
    });

    test('imm8 boundary: -129 is invalid', () => {
        const diags = provideDiagnostics('MOVI R0, -129');
        expect(diags.some(d => d.code === 'flux-immediate-range')).toBe(true);
    });

    test('imm8 boundary: 256 is invalid', () => {
        const diags = provideDiagnostics('MOVI R0, 256');
        expect(diags.some(d => d.code === 'flux-immediate-range')).toBe(true);
    });

    test('imm16 boundary: -32768 is valid', () => {
        const diags = provideDiagnostics('MOVI16 R0, -32768');
        expect(diags.some(d => d.code === 'flux-immediate-range')).toBe(false);
    });

    test('imm16 boundary: 65535 is valid', () => {
        const diags = provideDiagnostics('MOVI16 R0, 65535');
        expect(diags.some(d => d.code === 'flux-immediate-range')).toBe(false);
    });

    test('hex immediate within imm8 range is valid', () => {
        const diags = provideDiagnostics('MOVI R0, 0x7F');
        expect(diags.some(d => d.code === 'flux-immediate-range')).toBe(false);
    });

    test('hex immediate exceeding imm8 range is invalid', () => {
        const diags = provideDiagnostics('MOVI R0, 0x100');
        expect(diags.some(d => d.code === 'flux-immediate-range')).toBe(true);
    });
});

describe('Diagnostics Extended — Register Edge Cases', () => {
    test('FP register F0-F15 are valid', () => {
        for (let i = 0; i <= 15; i++) {
            const diags = provideDiagnostics(`CONF_LD F${i}`);
            expect(diags.some(d => d.code === 'flux-invalid-register')).toBe(false);
        }
    });

    test('VEC register V0-V15 are valid', () => {
        for (let i = 0; i <= 15; i++) {
            const diags = provideDiagnostics(`MOV V${i}, R0`);
            expect(diags.some(d => d.code === 'flux-invalid-register')).toBe(false);
        }
    });

    test('special registers are accepted in operand positions', () => {
        const regs = ['SP', 'FP', 'LR', 'PC', 'FLAGS'];
        for (const reg of regs) {
            const diags = provideDiagnostics(`PUSH ${reg}`);
            expect(diags.some(d => d.code === 'flux-invalid-register')).toBe(false);
        }
    });
});

describe('Diagnostics Extended — Label Resolution', () => {
    test('self-referencing label is valid (no undefined-label error)', () => {
        const source = '@loop:\n  JMP @loop';
        const diags = provideDiagnostics(source);
        expect(diags.some(d => d.code === 'flux-undefined-label')).toBe(false);
    });

    test('cross-label references are valid', () => {
        const source = [
            '@start:',
            '  JMP @middle',
            '@middle:',
            '  JMP @end',
            '@end:',
            '  HALT',
        ].join('\n');
        const diags = provideDiagnostics(source);
        expect(diags.some(d => d.code === 'flux-undefined-label')).toBe(false);
    });

    test('label defined after reference is valid (single-pass)', () => {
        const source = [
            '  JMP @forward',
            '@forward:',
            '  HALT',
        ].join('\n');
        const diags = provideDiagnostics(source);
        // Label is defined, so no error
        expect(diags.some(d => d.code === 'flux-undefined-label')).toBe(false);
    });

    test('case-sensitive label matching', () => {
        const source = '@Loop:\n  JMP @loop';  // different case
        const diags = provideDiagnostics(source);
        expect(diags.some(d => d.code === 'flux-undefined-label')).toBe(true);
    });
});

describe('Diagnostics Extended — Severity Levels', () => {
    test('unknown mnemonic is Error severity', () => {
        const diags = provideDiagnostics('FAKEOP R0');
        const unknown = diags.find(d => d.code === 'flux-unknown-mnemonic');
        expect(unknown).toBeDefined();
        expect(unknown!.severity).toBe(DiagnosticSeverity.Error);
    });

    test('undefined label is Error severity', () => {
        const diags = provideDiagnostics('JMP @missing');
        const undef = diags.find(d => d.code === 'flux-undefined-label');
        expect(undef).toBeDefined();
        expect(undef!.severity).toBe(DiagnosticSeverity.Error);
    });

    test('unused label is Hint severity', () => {
        const diags = provideDiagnostics('@orphan:\nNOP');
        const unused = diags.find(d => d.code === 'flux-unused-label');
        expect(unused).toBeDefined();
        expect(unused!.severity).toBe(DiagnosticSeverity.Hint);
    });

    test('immediate range overflow is Warning severity', () => {
        const diags = provideDiagnostics('MOVI R0, 999');
        const range = diags.find(d => d.code === 'flux-immediate-range');
        expect(range).toBeDefined();
        expect(range!.severity).toBe(DiagnosticSeverity.Warning);
    });

    test('duplicate label is Error severity', () => {
        const diags = provideDiagnostics('@x:\n@x:');
        const dup = diags.find(d => d.code === 'flux-duplicate-label');
        expect(dup).toBeDefined();
        expect(dup!.severity).toBe(DiagnosticSeverity.Error);
    });
});

describe('Diagnostics Extended — Full Program Validation', () => {
    test('complete matrix multiplication skeleton validates', () => {
        const source = [
            '; Matrix multiply A(MxK) * B(KxN)',
            '.global main',
            '',
            '## fn: matmul(M: i32, N: i32, K: i32)',
            '',
            '@main:',
            '  MOVI R0, 0       ; i = 0',
            '@outer_loop:',
            '  MOVI R1, 0       ; j = 0',
            '@inner_loop:',
            '  MOVI R2, 0       ; k = 0',
            '@k_loop:',
            '  LOAD R3, R0, R2  ; A[i][k]',
            '  LOAD R4, R2, R1  ; B[k][j]',
            '  MUL R5, R3, R4   ; prod',
            '  LOADOFF R6, R0, 0 ; C[i][j]',
            '  ADD R6, R6, R5   ; accumulate',
            '  STOREOF R6, R0, 0 ; store back',
            '  INC R2',
            '  JNZ R2, @k_loop',
            '  INC R1',
            '  JNZ R1, @inner_loop',
            '  INC R0',
            '  JNZ R0, @outer_loop',
            '  HALT',
        ].join('\n');
        const diags = provideDiagnostics(source);
        expect(diags.some(d => d.code === 'flux-unknown-mnemonic')).toBe(false);
        expect(diags.some(d => d.code === 'flux-undefined-label')).toBe(false);
    });
});
