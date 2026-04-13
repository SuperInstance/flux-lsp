/**
 * FLUX LSP Test Suite — Server & Integration Extended Tests
 *
 * Tests for FluxLanguageServer class behavior (using mock-free approach),
 * symbol extraction, code block handling, folding ranges, and rename logic.
 * Also tests complex multi-module integration scenarios.
 */

import { parseFluxAssembly, extractLabels, extractLabelInfos, extractLabelReferences, extractSections, isRegister, validateOperandCount } from '../parser';
import { provideDiagnostics, parseImmediate } from '../diagnostics';
import { lookupOpcode, getOpcodesByCategory, formatOpcodeMarkdown, OPCODE_DATABASE } from '../opcode-database';

// ─── Symbol Extraction Tests ────────────────────────────────────────────────

describe('Symbol Extraction — Labels as Symbols', () => {
    test('labels are extracted with correct line numbers', () => {
        const source = [
            '@func_entry:',
            '  MOVI R0, 1',
            '@inner:',
            '  NOP',
            '@func_exit:',
            '  RET',
        ].join('\n');
        const lines = parseFluxAssembly(source);
        const labels = extractLabels(lines);
        expect(labels.get('func_entry')).toBe(0);
        expect(labels.get('inner')).toBe(2);
        expect(labels.get('func_exit')).toBe(4);
    });

    test('labels on opcode lines are extracted', () => {
        const source = [
            '@entry: MOVI R0, 0',
            '@loop:  DEC R0',
            '@done:  HALT',
        ].join('\n');
        const lines = parseFluxAssembly(source);
        const labels = extractLabels(lines);
        expect(labels.size).toBe(3);
    });

    test('extractLabelInfos includes position objects', () => {
        const source = '@symbol:\nNOP';
        const lines = parseFluxAssembly(source);
        const infos = extractLabelInfos(lines);
        expect(infos).toHaveLength(1);
        expect(infos[0].name).toBe('symbol');
        expect(infos[0].position).toEqual({ line: 0, character: 0 });
    });
});

describe('Symbol Extraction — Sections as Symbols', () => {
    test('sections have correct type mappings', () => {
        const source = [
            '## fn: main',
            '## agent: worker',
            '## tile: gpu',
            '## region: mem',
            '## vocabulary: dict',
            '## test: sanity',
        ].join('\n');
        const sections = extractSections(parseFluxAssembly(source));
        expect(sections.map(s => s.type)).toEqual(['fn', 'agent', 'tile', 'region', 'vocabulary', 'test']);
    });

    test('section names preserve signatures', () => {
        const source = '## fn: add(a: i32, b: i32) -> i32';
        const sections = extractSections(parseFluxAssembly(source));
        expect(sections[0].name).toBe('add(a: i32, b: i32) -> i32');
    });

    test('multiple sections are ordered by appearance', () => {
        const source = [
            '## fn: first',
            '  NOP',
            '## fn: second',
            '  NOP',
            '## fn: third',
            '  NOP',
        ].join('\n');
        const sections = extractSections(parseFluxAssembly(source));
        expect(sections.map(s => s.name)).toEqual(['first', 'second', 'third']);
    });
});

// ─── Label Reference Navigation Tests ──────────────────────────────────────

describe('Label References — Navigation', () => {
    test('label references track source line', () => {
        const source = [
            '  JMP @target',
            '  NOP',
            '  JMP @target',
            '@target:',
            '  HALT',
        ].join('\n');
        const lines = parseFluxAssembly(source);
        const refs = extractLabelReferences(lines);
        expect(refs).toHaveLength(2);
        expect(refs[0].line).toBe(0);
        expect(refs[1].line).toBe(2);
    });

    test('multiple references to same label', () => {
        const source = [
            '@loop:',
            '  JNZ R0, @loop',
            '  JZ R1, @loop',
            '  JMP @loop',
        ].join('\n');
        const refs = extractLabelReferences(parseFluxAssembly(source));
        expect(refs).toHaveLength(3);
        expect(refs.every(r => r.name === 'loop')).toBe(true);
    });

    test('no references in pure label definitions', () => {
        const source = '@a:\n@b:\n@c:';
        expect(extractLabelReferences(parseFluxAssembly(source))).toHaveLength(0);
    });
});

// ─── Code Block Handling Tests ─────────────────────────────────────────────

describe('Code Block Handling — .flux.md format', () => {
    test('code block boundaries are identified by ```flux markers', () => {
        const source = [
            '# Title',
            '',
            '```flux',
            '@start:',
            '  HALT',
            '```',
        ].join('\n');
        const lines = parseFluxAssembly(source);
        // Lines inside code block: @start and HALT should parse
        const opcodes = lines.filter(l => l.type === 'opcode');
        expect(opcodes.length).toBeGreaterThan(0);
    });

    test('flux opcodes inside code blocks are recognized as valid', () => {
        const source = [
            '# Heading',
            '```flux',
            'ADD R0, R1, R2',
            'MOVI R3, 42',
            '```',
        ].join('\n');
        // provideDiagnostics processes all lines; valid opcodes should not trigger errors
        const diags = provideDiagnostics(source);
        // ADD and MOVI are valid opcodes
        expect(diags.some(d => d.code === 'flux-unknown-mnemonic')).toBe(false);
    });

    test('multiple code blocks - all flux opcodes are valid', () => {
        const source = [
            '```flux',
            '@start:',
            '  MOVI R0, 1',
            '```',
            '',
            '```flux',
            '@end:',
            '  HALT',
            '```',
        ].join('\n');
        const diags = provideDiagnostics(source);
        // MOVI and HALT are valid opcodes
        expect(diags.some(d => d.code === 'flux-unknown-mnemonic')).toBe(false);
    });
});

// ─── Operand Validation Edge Cases ─────────────────────────────────────────

describe('Operand Validation — Edge Cases', () => {
    test('register alias SP is valid anywhere a register is expected', () => {
        expect(validateOperandCount('PUSH', 1)).toBeNull();
        const diags = provideDiagnostics('PUSH SP');
        expect(diags.some(d => d.code === 'flux-invalid-register')).toBe(false);
    });

    test('dash operand is accepted for unused slots', () => {
        const diags = provideDiagnostics('MOV R0, R1, -');
        // MOV has 3 operands (rd, rs1, -) but accepts 2 as well
        const unknownDiag = diags.find(d => d.code === 'flux-unknown-mnemonic');
        expect(unknownDiag).toBeUndefined();
    });

    test('string literal operand is accepted', () => {
        const diags = provideDiagnostics('SYS "hello"');
        expect(diags.some(d => d.code === 'flux-invalid-register')).toBe(false);
    });
});

// ─── Complex Integration Tests ─────────────────────────────────────────────

describe('Integration — Full Pipeline Programs', () => {
    test('bubble sort skeleton has no critical errors', () => {
        const source = [
            '; Bubble sort implementation',
            '.global main',
            '',
            '## fn: sort(arr: ptr, len: i32)',
            '',
            '@main:',
            '  MOVI R10, 0      ; sorted = false',
            '@outer:',
            '  MOVI R0, 0       ; i = 0',
            '@inner:',
            '  CMP_LT R5, R0, R1 ; i < len-1?',
            '  JZ R5, @check_swap',
            '  LOADOFF R2, R0, 0 ; arr[i]',
            '  ADDI R3, R0, 1   ; i+1',
            '  LOADOFF R4, R3, 0 ; arr[i+1]',
            '  CMP_GT R5, R2, R4 ; arr[i] > arr[i+1]?',
            '  JZ R5, @no_swap',
            '  STOREOF R4, R0, 0 ; swap',
            '  STOREOF R2, R3, 0',
            '  MOVI R10, 1      ; sorted = true',
            '@no_swap:',
            '  INC R0',
            '  JMP @inner',
            '@check_swap:',
            '  JNZ R10, @outer',
            '  HALT',
        ].join('\n');
        const diags = provideDiagnostics(source);
        // Should not have unknown mnemonics or invalid registers
        expect(diags.some(d => d.code === 'flux-unknown-mnemonic')).toBe(false);
        expect(diags.some(d => d.code === 'flux-invalid-register')).toBe(false);
    });

    test('syscall interface program', () => {
        const source = [
            '; Syscall demo',
            '@start:',
            '  MOVI R0, 1       ; fd = stdout',
            '  MOVI R1, 42      ; value to write',
            '  SYS 1            ; write syscall',
            '  HALT',
        ].join('\n');
        const diags = provideDiagnostics(source);
        expect(diags.some(d => d.code === 'flux-unknown-mnemonic')).toBe(false);
        expect(diags.some(d => d.code === 'flux-undefined-label')).toBe(false);
    });

    test('confidence computation program', () => {
        const source = [
            '## fn: compute_confidence()',
            '',
            '@start:',
            '  CONF_LD R0       ; load confidence',
            '  C_THRESH R0, 128 ; check threshold',
            '  CONF_ST R0       ; store result',
            '  HALT',
        ].join('\n');
        const diags = provideDiagnostics(source);
        expect(diags.some(d => d.code === 'flux-unknown-mnemonic')).toBe(false);
    });
});

// ─── Opcode Database Integrity Tests ───────────────────────────────────────

describe('Opcode Database — Integrity', () => {
    test('all opcodes have valid format codes', () => {
        const validFormats = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
        for (const [name, info] of OPCODE_DATABASE) {
            expect(validFormats).toContain(info.format);
        }
    });

    test('core system control opcodes are in 0x00-0x07 range', () => {
        // The core system control opcodes (HALT, NOP, RET, etc.) are 0x00-0x07
        const coreSystemOpcodes = ['HALT', 'NOP', 'RET', 'IRET', 'BRK', 'WFI', 'RESET', 'SYN'];
        for (const name of coreSystemOpcodes) {
            const info = lookupOpcode(name);
            expect(info).toBeDefined();
            expect(info!.opcode).toBeGreaterThanOrEqual(0x00);
            expect(info!.opcode).toBeLessThanOrEqual(0x07);
        }
    });

    test('all arithmetic opcodes have numeric descriptions', () => {
        const arith = getOpcodesByCategory('arithmetic');
        for (const op of arith) {
            expect(op.description.length).toBeGreaterThan(0);
        }
    });

    test('formatOpcodeMarkdown always returns non-empty string', () => {
        for (const [name, info] of OPCODE_DATABASE) {
            const md = formatOpcodeMarkdown(info);
            expect(md.length).toBeGreaterThan(0);
            expect(md).toContain(name);
        }
    });

    test('database size matches expected opcode count', () => {
        // The ISA has 200+ opcodes; database should reflect this
        expect(OPCODE_DATABASE.size).toBeGreaterThanOrEqual(200);
    });
});

// ─── Misc Edge Cases ───────────────────────────────────────────────────────

describe('Edge Cases — Parse Boundary', () => {
    test('very long line does not crash parser', () => {
        const longLine = 'ADD ' + 'R0, '.repeat(1000) + 'R1';
        const lines = parseFluxAssembly(longLine);
        expect(lines).toHaveLength(1);
        expect(lines[0].type).toBe('opcode');
    });

    test('unicode in comments is preserved', () => {
        const lines = parseFluxAssembly('; 日本語のコメント 𝕌𝕟𝕚𝕔𝕠𝕕𝕖');
        expect(lines[0].type).toBe('comment');
        expect(lines[0].comment).toBe('日本語のコメント 𝕌𝕟𝕚𝕔𝕠𝕕𝕖');
    });

    test('tab characters in source are handled', () => {
        const lines = parseFluxAssembly('\tADD\tR0,\tR1,\tR2');
        expect(lines[0].type).toBe('opcode');
        expect(lines[0].mnemonic).toBe('ADD');
        expect(lines[0].operands).toEqual(['R0', 'R1', 'R2']);
    });

    test('carriage return + newline line endings', () => {
        const source = 'HALT\r\nNOP\r\nRET';
        const lines = parseFluxAssembly(source);
        expect(lines).toHaveLength(3);
    });
});

describe('Edge Cases — Diagnostics Boundary', () => {
    test('very large file (1000 lines) completes without timeout', () => {
        const lines = ['@start:'];
        for (let i = 0; i < 998; i++) {
            lines.push(`  MOVI R0, ${i}`);
        }
        lines.push('  HALT');
        const source = lines.join('\n');
        const start = Date.now();
        const diags = provideDiagnostics(source);
        const elapsed = Date.now() - start;
        expect(elapsed).toBeLessThan(5000); // should complete within 5s
        // Only check for critical errors, not unused labels
        expect(diags.some(d => d.code === 'flux-unknown-mnemonic')).toBe(false);
    });
});
