/**
 * opcodes.ts — Complete FLUX opcode table for the Language Server
 *
 * WHY: Completion and hover providers need to know every valid mnemonic,
 * its opcode, format, operand types, and description. This data comes from
 * grammar-spec.md Section 6.7 (full mnemonic list) and ISA.md (format encoding).
 * Rather than hardcoding completion strings, we maintain a structured table that
 * serves multiple providers: completion (mnemonics), hover (descriptions), and
 * diagnostics (format validation).
 *
 * DECISION: Group opcodes by functional category (matching the ISA spec's opcode
 * ranges 0x00-0xFF) rather than alphabetically. Rationale: when a developer types
 * a partial mnemonic, they're usually thinking about the operation category
 * (arithmetic, memory, A2A) not the letter it starts with. This grouping also
 * enables context-aware completion (e.g., only show A2A ops inside agent sections).
 *
 * TIMESTAMP: 2026-04-12T02:05:00Z — Session 8, LSP scaffolding
 */

import { Position, Range } from './types';

/** Instruction format (from ISA.md) — determines operand count and encoding */
export enum Format {
  A = 'A', // 1 byte: [opcode] — zero operands
  B = 'B', // 2 bytes: [opcode][reg:u8] — single register
  C = 'C', // 2 bytes: [opcode][imm8:u8] — single immediate
  D = 'D', // 3 bytes: [opcode][reg:u8][imm8:i8] — register + imm8
  E = 'E', // 4 bytes: [opcode][rd:u8][rs1:u8][rs2:u8] — three registers
  F = 'F', // 4 bytes: [opcode][reg:u8][imm16:i16] — register + imm16
  G = 'G', // 5 bytes: [opcode][rd:u8][rs1:u8][imm16:i16] — two regs + imm16
}

/** Operand type for completion formatting */
export enum OperandType {
  NONE = 'none',
  REG = 'reg',     // general register R0-R15
  FREG = 'freg',   // float register F0-F15
  VREG = 'vreg',   // vector register V0-V15
  IMM = 'imm',     // immediate value
  LABEL = 'label', // code label @name
  STRING = 'str',  // string literal
}

/** Single operand descriptor */
export interface OperandDesc {
  type: OperandType;
  name: string;       // e.g., "rd", "rs1", "imm8"
  description: string;
}

/** Complete opcode entry */
export interface OpcodeEntry {
  mnemonic: string;
  opcode: number;      // hex opcode value
  format: Format;
  operands: OperandDesc[];
  category: string;
  description: string;
  example?: string;
}

// ─── Opcode Categories ───

export const CATEGORIES = [
  'system',      // 0x00-0x07
  'single_reg',  // 0x08-0x0F
  'immediate',   // 0x10-0x17
  'reg_imm8',    // 0x18-0x1F
  'int_arith',   // 0x20-0x2F
  'float_mem',   // 0x30-0x3F
  'reg_imm16',   // 0x40-0x47
  'triple',      // 0x48-0x4F
  'a2a',         // 0x50-0x5F
  'confidence',  // 0x60-0x6F
  'viewpoint',   // 0x70-0x7F
  'sensor',      // 0x80-0x8F
  'math_crypto', // 0x90-0x9F
  'collection',  // 0xA0-0xAF
  'vector',      // 0xB0-0xBF
  'tensor',      // 0xC0-0xCF
  'memory_io',   // 0xD0-0xDF
  'long_jump',   // 0xE0-0xEF
  'ext_system',  // 0xF0-0xFF
] as const;

export type OpcodeCategory = typeof CATEGORIES[number];

// ─── Register Sets ───

export const GP_REGISTERS = Array.from({ length: 16 }, (_, i) => `R${i}`);
export const FP_REGISTERS = Array.from({ length: 16 }, (_, i) => `F${i}`);
export const VEC_REGISTERS = Array.from({ length: 16 }, (_, i) => `V${i}`);
export const SPECIAL_REGISTERS = ['SP', 'FP', 'LR', 'PC', 'FLAGS'];

export const ALL_REGISTERS = [
  ...GP_REGISTERS.map(r => ({ name: r, type: OperandType.REG, description: `General-purpose register ${r}` })),
  ...FP_REGISTERS.map(r => ({ name: r, type: OperandType.FREG, description: `Float register ${r}` })),
  ...VEC_REGISTERS.map(r => ({ name: r, type: OperandType.VREG, description: `Vector register ${r}` })),
  ...SPECIAL_REGISTERS.map(r => ({ name: r, type: OperandType.REG, description: `Special register ${r}` })),
];

// ─── Primitive Types ───

export const PRIMITIVE_TYPES = [
  'i8', 'i16', 'i32', 'i64',
  'u8', 'u16', 'u32', 'u64',
  'f32', 'f64',
  'bool', 'void',
] as const;

// ─── Full Opcode Table ───

// Helper to reduce repetition
const none: OperandDesc = { type: OperandType.NONE, name: '', description: 'No operands' };
const rd: OperandDesc = { type: OperandType.REG, name: 'rd', description: 'Destination register' };
const rs1: OperandDesc = { type: OperandType.REG, name: 'rs1', description: 'Source register 1' };
const rs2: OperandDesc = { type: OperandType.REG, name: 'rs2', description: 'Source register 2' };
const imm8: OperandDesc = { type: OperandType.IMM, name: 'imm8', description: '8-bit immediate' };
const imm16: OperandDesc = { type: OperandType.IMM, name: 'imm16', description: '16-bit immediate' };
const label: OperandDesc = { type: OperandType.LABEL, name: 'label', description: 'Code label' };
const str: OperandDesc = { type: OperandType.STRING, name: 'str', description: 'String argument' };

export const OPCODES: OpcodeEntry[] = [
  // ── System Control (0x00-0x07) ──
  { mnemonic: 'HALT', opcode: 0x00, format: Format.A, operands: [none], category: 'system', description: 'Halt execution', example: 'HALT' },
  { mnemonic: 'NOP', opcode: 0x01, format: Format.A, operands: [none], category: 'system', description: 'No operation', example: 'NOP' },
  { mnemonic: 'RET', opcode: 0x02, format: Format.A, operands: [none], category: 'system', description: 'Return from subroutine (pop LR into PC)', example: 'RET' },
  { mnemonic: 'IRET', opcode: 0x03, format: Format.A, operands: [none], category: 'system', description: 'Return from interrupt', example: 'IRET' },
  { mnemonic: 'BRK', opcode: 0x04, format: Format.A, operands: [none], category: 'system', description: 'Breakpoint — enter debugger', example: 'BRK' },
  { mnemonic: 'WFI', opcode: 0x05, format: Format.A, operands: [none], category: 'system', description: 'Wait for interrupt', example: 'WFI' },
  { mnemonic: 'RESET', opcode: 0x06, format: Format.A, operands: [none], category: 'system', description: 'Reset the VM', example: 'RESET' },
  { mnemonic: 'SYN', opcode: 0x07, format: Format.A, operands: [none], category: 'system', description: 'Synchronization barrier', example: 'SYN' },

  // ── Single Register (0x08-0x0F) ──
  { mnemonic: 'INC', opcode: 0x08, format: Format.B, operands: [rd], category: 'single_reg', description: 'Increment register by 1', example: 'INC R0' },
  { mnemonic: 'DEC', opcode: 0x09, format: Format.B, operands: [rd], category: 'single_reg', description: 'Decrement register by 1', example: 'DEC R0' },
  { mnemonic: 'NOT', opcode: 0x0A, format: Format.B, operands: [rd], category: 'single_reg', description: 'Bitwise NOT', example: 'NOT R0' },
  { mnemonic: 'NEG', opcode: 0x0B, format: Format.B, operands: [rd], category: 'single_reg', description: 'Negate (two\'s complement)', example: 'NEG R0' },
  { mnemonic: 'PUSH', opcode: 0x0C, format: Format.B, operands: [rd], category: 'single_reg', description: 'Push register onto stack', example: 'PUSH R0' },
  { mnemonic: 'POP', opcode: 0x0D, format: Format.B, operands: [rd], category: 'single_reg', description: 'Pop top of stack into register', example: 'POP R0' },
  { mnemonic: 'CONF_LD', opcode: 0x0E, format: Format.B, operands: [rd], category: 'single_reg', description: 'Load confidence value', example: 'CONF_LD R0' },
  { mnemonic: 'CONF_ST', opcode: 0x0F, format: Format.B, operands: [rd], category: 'single_reg', description: 'Store confidence value', example: 'CONF_ST R0' },

  // ── Immediate Only (0x10-0x17) ──
  { mnemonic: 'SYS', opcode: 0x10, format: Format.C, operands: [imm8], category: 'immediate', description: 'System call', example: 'SYS 0x01' },
  { mnemonic: 'TRAP', opcode: 0x11, format: Format.C, operands: [imm8], category: 'immediate', description: 'Software trap/interrupt', example: 'TRAP 3' },
  { mnemonic: 'DBG', opcode: 0x12, format: Format.C, operands: [imm8], category: 'immediate', description: 'Debug output', example: 'DBG 1' },
  { mnemonic: 'CLF', opcode: 0x13, format: Format.C, operands: [imm8], category: 'immediate', description: 'Clear flags', example: 'CLF 0xFF' },
  { mnemonic: 'SEMA', opcode: 0x14, format: Format.C, operands: [imm8], category: 'immediate', description: 'Semaphore operation', example: 'SEMA 1' },
  { mnemonic: 'YIELD', opcode: 0x15, format: Format.C, operands: [imm8], category: 'immediate', description: 'Yield timeslice', example: 'YIELD 0' },
  { mnemonic: 'CACHE', opcode: 0x16, format: Format.C, operands: [imm8], category: 'immediate', description: 'Cache management hint', example: 'CACHE 0' },
  { mnemonic: 'STRIPCF', opcode: 0x17, format: Format.C, operands: [imm8], category: 'immediate', description: 'Strip confidence from value', example: 'STRIPCF R0' },

  // ── Register + Imm8 (0x18-0x1F) ──
  { mnemonic: 'MOVI', opcode: 0x18, format: Format.D, operands: [rd, imm8], category: 'reg_imm8', description: 'Move immediate into register', example: 'MOVI R0, 42' },
  { mnemonic: 'ADDI', opcode: 0x19, format: Format.D, operands: [rd, imm8], category: 'reg_imm8', description: 'Add immediate to register', example: 'ADDI R0, 5' },
  { mnemonic: 'SUBI', opcode: 0x1A, format: Format.D, operands: [rd, imm8], category: 'reg_imm8', description: 'Subtract immediate from register', example: 'SUBI R0, 3' },
  { mnemonic: 'ANDI', opcode: 0x1B, format: Format.D, operands: [rd, imm8], category: 'reg_imm8', description: 'Bitwise AND with immediate', example: 'ANDI R0, 0xFF' },
  { mnemonic: 'ORI', opcode: 0x1C, format: Format.D, operands: [rd, imm8], category: 'reg_imm8', description: 'Bitwise OR with immediate', example: 'ORI R0, 0x10' },
  { mnemonic: 'XORI', opcode: 0x1D, format: Format.D, operands: [rd, imm8], category: 'reg_imm8', description: 'Bitwise XOR with immediate', example: 'XORI R0, 0xFF' },
  { mnemonic: 'SHLI', opcode: 0x1E, format: Format.D, operands: [rd, imm8], category: 'reg_imm8', description: 'Shift left by immediate', example: 'SHLI R0, 4' },
  { mnemonic: 'SHRI', opcode: 0x1F, format: Format.D, operands: [rd, imm8], category: 'reg_imm8', description: 'Shift right by immediate', example: 'SHRI R0, 2' },

  // ── Integer Arithmetic (0x20-0x2F) ──
  { mnemonic: 'ADD', opcode: 0x20, format: Format.E, operands: [rd, rs1, rs2], category: 'int_arith', description: 'Integer addition: rd = rs1 + rs2', example: 'ADD R0, R1, R2' },
  { mnemonic: 'SUB', opcode: 0x21, format: Format.E, operands: [rd, rs1, rs2], category: 'int_arith', description: 'Integer subtraction: rd = rs1 - rs2', example: 'SUB R0, R1, R2' },
  { mnemonic: 'MUL', opcode: 0x22, format: Format.E, operands: [rd, rs1, rs2], category: 'int_arith', description: 'Integer multiplication: rd = rs1 * rs2', example: 'MUL R0, R1, R2' },
  { mnemonic: 'DIV', opcode: 0x23, format: Format.E, operands: [rd, rs1, rs2], category: 'int_arith', description: 'Integer division: rd = rs1 / rs2', example: 'DIV R0, R1, R2' },
  { mnemonic: 'MOD', opcode: 0x24, format: Format.E, operands: [rd, rs1, rs2], category: 'int_arith', description: 'Integer modulo: rd = rs1 % rs2', example: 'MOD R0, R1, R2' },
  { mnemonic: 'AND', opcode: 0x25, format: Format.E, operands: [rd, rs1, rs2], category: 'int_arith', description: 'Bitwise AND: rd = rs1 & rs2', example: 'AND R0, R1, R2' },
  { mnemonic: 'OR', opcode: 0x26, format: Format.E, operands: [rd, rs1, rs2], category: 'int_arith', description: 'Bitwise OR: rd = rs1 | rs2', example: 'OR R0, R1, R2' },
  { mnemonic: 'XOR', opcode: 0x27, format: Format.E, operands: [rd, rs1, rs2], category: 'int_arith', description: 'Bitwise XOR: rd = rs1 ^ rs2', example: 'XOR R0, R1, R2' },
  { mnemonic: 'SHL', opcode: 0x28, format: Format.E, operands: [rd, rs1, rs2], category: 'int_arith', description: 'Shift left: rd = rs1 << rs2', example: 'SHL R0, R1, R2' },
  { mnemonic: 'SHR', opcode: 0x29, format: Format.E, operands: [rd, rs1, rs2], category: 'int_arith', description: 'Shift right: rd = rs1 >> rs2', example: 'SHR R0, R1, R2' },
  { mnemonic: 'MIN', opcode: 0x2A, format: Format.E, operands: [rd, rs1, rs2], category: 'int_arith', description: 'Minimum: rd = min(rs1, rs2)', example: 'MIN R0, R1, R2' },
  { mnemonic: 'MAX', opcode: 0x2B, format: Format.E, operands: [rd, rs1, rs2], category: 'int_arith', description: 'Maximum: rd = max(rs1, rs2)', example: 'MAX R0, R1, R2' },
  { mnemonic: 'CMP_EQ', opcode: 0x2C, format: Format.E, operands: [rd, rs1, rs2], category: 'int_arith', description: 'Compare equal: rd = (rs1 == rs2) ? 1 : 0', example: 'CMP_EQ R0, R1, R2' },
  { mnemonic: 'CMP_LT', opcode: 0x2D, format: Format.E, operands: [rd, rs1, rs2], category: 'int_arith', description: 'Compare less than: rd = (rs1 < rs2) ? 1 : 0', example: 'CMP_LT R0, R1, R2' },
  { mnemonic: 'CMP_GT', opcode: 0x2E, format: Format.E, operands: [rd, rs1, rs2], category: 'int_arith', description: 'Compare greater than: rd = (rs1 > rs2) ? 1 : 0', example: 'CMP_GT R0, R1, R2' },
  { mnemonic: 'CMP_NE', opcode: 0x2F, format: Format.E, operands: [rd, rs1, rs2], category: 'int_arith', description: 'Compare not equal: rd = (rs1 != rs2) ? 1 : 0', example: 'CMP_NE R0, R1, R2' },

  // ── Float, Memory, Control (0x30-0x3F) ──
  { mnemonic: 'FADD', opcode: 0x30, format: Format.E, operands: [{ type: OperandType.FREG, name: 'fd', description: 'Float destination' }, { type: OperandType.FREG, name: 'fs1', description: 'Float source 1' }, { type: OperandType.FREG, name: 'fs2', description: 'Float source 2' }], category: 'float_mem', description: 'Float addition', example: 'FADD F0, F1, F2' },
  { mnemonic: 'FSUB', opcode: 0x31, format: Format.E, operands: [{ type: OperandType.FREG, name: 'fd', description: 'Float destination' }, { type: OperandType.FREG, name: 'fs1', description: 'Float source 1' }, { type: OperandType.FREG, name: 'fs2', description: 'Float source 2' }], category: 'float_mem', description: 'Float subtraction', example: 'FSUB F0, F1, F2' },
  { mnemonic: 'FMUL', opcode: 0x32, format: Format.E, operands: [{ type: OperandType.FREG, name: 'fd', description: 'Float destination' }, { type: OperandType.FREG, name: 'fs1', description: 'Float source 1' }, { type: OperandType.FREG, name: 'fs2', description: 'Float source 2' }], category: 'float_mem', description: 'Float multiplication', example: 'FMUL F0, F1, F2' },
  { mnemonic: 'FDIV', opcode: 0x33, format: Format.E, operands: [{ type: OperandType.FREG, name: 'fd', description: 'Float destination' }, { type: OperandType.FREG, name: 'fs1', description: 'Float source 1' }, { type: OperandType.FREG, name: 'fs2', description: 'Float source 2' }], category: 'float_mem', description: 'Float division', example: 'FDIV F0, F1, F2' },
  { mnemonic: 'FMIN', opcode: 0x34, format: Format.E, operands: [{ type: OperandType.FREG, name: 'fd', description: 'Float destination' }, { type: OperandType.FREG, name: 'fs1', description: 'Float source 1' }, { type: OperandType.FREG, name: 'fs2', description: 'Float source 2' }], category: 'float_mem', description: 'Float minimum', example: 'FMIN F0, F1, F2' },
  { mnemonic: 'FMAX', opcode: 0x35, format: Format.E, operands: [{ type: OperandType.FREG, name: 'fd', description: 'Float destination' }, { type: OperandType.FREG, name: 'fs1', description: 'Float source 1' }, { type: OperandType.FREG, name: 'fs2', description: 'Float source 2' }], category: 'float_mem', description: 'Float maximum', example: 'FMAX F0, F1, F2' },
  { mnemonic: 'FTOI', opcode: 0x36, format: Format.B, operands: [rd], category: 'float_mem', description: 'Float to integer conversion', example: 'FTOI R0' },
  { mnemonic: 'ITOF', opcode: 0x37, format: Format.B, operands: [rd], category: 'float_mem', description: 'Integer to float conversion', example: 'ITOF R0' },
  { mnemonic: 'LOAD', opcode: 0x38, format: Format.E, operands: [rd, rs1, rs2], category: 'float_mem', description: 'Load from memory: rd = mem[rs1 + rs2]', example: 'LOAD R0, R1, R2' },
  { mnemonic: 'STORE', opcode: 0x39, format: Format.E, operands: [rd, rs1, rs2], category: 'float_mem', description: 'Store to memory: mem[rs1 + rs2] = rd', example: 'STORE R0, R1, R2' },
  { mnemonic: 'MOV', opcode: 0x3A, format: Format.E, operands: [rd, rs1, { type: OperandType.NONE, name: '', description: 'Unused' }], category: 'float_mem', description: 'Register copy: rd = rs1', example: 'MOV R0, R1' },
  { mnemonic: 'SWP', opcode: 0x3B, format: Format.E, operands: [rd, rs1, rs2], category: 'float_mem', description: 'Swap: rd<->rs1, with rs2 as temp', example: 'SWP R0, R1, R2' },
  { mnemonic: 'JZ', opcode: 0x3C, format: Format.E, operands: [rd, rs1, { type: OperandType.LABEL, name: 'target', description: 'Jump target' }], category: 'float_mem', description: 'Jump if zero flag set', example: 'JZ R0, R1, @target' },
  { mnemonic: 'JNZ', opcode: 0x3D, format: Format.E, operands: [rd, rs1, { type: OperandType.LABEL, name: 'target', description: 'Jump target' }], category: 'float_mem', description: 'Jump if zero flag not set', example: 'JNZ R0, R1, @target' },
  { mnemonic: 'JLT', opcode: 0x3E, format: Format.E, operands: [rd, rs1, { type: OperandType.LABEL, name: 'target', description: 'Jump target' }], category: 'float_mem', description: 'Jump if less than (signed)', example: 'JLT R0, R1, @target' },
  { mnemonic: 'JGT', opcode: 0x3F, format: Format.E, operands: [rd, rs1, { type: OperandType.LABEL, name: 'target', description: 'Jump target' }], category: 'float_mem', description: 'Jump if greater than (signed)', example: 'JGT R0, R1, @target' },

  // ── Register + Imm16 (0x40-0x47) ──
  { mnemonic: 'MOVI16', opcode: 0x40, format: Format.F, operands: [rd, imm16], category: 'reg_imm16', description: 'Move 16-bit immediate into register', example: 'MOVI16 R0, 1000' },
  { mnemonic: 'ADDI16', opcode: 0x41, format: Format.F, operands: [rd, imm16], category: 'reg_imm16', description: 'Add 16-bit immediate', example: 'ADDI16 R0, 100' },
  { mnemonic: 'SUBI16', opcode: 0x42, format: Format.F, operands: [rd, imm16], category: 'reg_imm16', description: 'Subtract 16-bit immediate', example: 'SUBI16 R0, 50' },
  { mnemonic: 'JMP', opcode: 0x43, format: Format.F, operands: [rd, { type: OperandType.LABEL, name: 'target', description: 'Jump target label or offset' }], category: 'reg_imm16', description: 'Unconditional jump to label/offset', example: 'JMP @loop' },
  { mnemonic: 'JAL', opcode: 0x44, format: Format.F, operands: [rd, { type: OperandType.LABEL, name: 'target', description: 'Jump target' }], category: 'reg_imm16', description: 'Jump and link (save return address)', example: 'JAL LR, @target' },
  { mnemonic: 'CALL', opcode: 0x45, format: Format.F, operands: [rd, { type: OperandType.LABEL, name: 'target', description: 'Function to call' }], category: 'reg_imm16', description: 'Call subroutine', example: 'CALL LR, @factorial' },
  { mnemonic: 'LOOP', opcode: 0x46, format: Format.F, operands: [rd, { type: OperandType.LABEL, name: 'target', description: 'Loop start' }], category: 'reg_imm16', description: 'Decrement R0 and branch if non-zero', example: 'LOOP R0, @start' },
  { mnemonic: 'SELECT', opcode: 0x47, format: Format.F, operands: [rd, imm16], category: 'reg_imm16', description: 'Conditional select based on flags', example: 'SELECT R0, 1' },

  // ── Register + Register + Imm16 (0x48-0x4F) ──
  { mnemonic: 'LOADOFF', opcode: 0x48, format: Format.G, operands: [rd, rs1, imm16], category: 'triple', description: 'Load with offset: rd = mem[rs1 + offset]', example: 'LOADOFF R0, R1, 100' },
  { mnemonic: 'STOREOF', opcode: 0x49, format: Format.G, operands: [rd, rs1, imm16], category: 'triple', description: 'Store with offset: mem[rs1 + offset] = rd', example: 'STOREOF R0, R1, 100' },
  { mnemonic: 'LOADI', opcode: 0x4A, format: Format.G, operands: [rd, rs1, imm16], category: 'triple', description: 'Load indexed', example: 'LOADI R0, R1, 4' },
  { mnemonic: 'STOREI', opcode: 0x4B, format: Format.G, operands: [rd, rs1, imm16], category: 'triple', description: 'Store indexed', example: 'STOREI R0, R1, 4' },
  { mnemonic: 'ENTER', opcode: 0x4C, format: Format.G, operands: [rd, rs1, imm16], category: 'triple', description: 'Enter stack frame', example: 'ENTER FP, SP, 32' },
  { mnemonic: 'LEAVE', opcode: 0x4D, format: Format.G, operands: [rd, rs1, imm16], category: 'triple', description: 'Leave stack frame', example: 'LEAVE FP, SP, 32' },
  { mnemonic: 'COPY', opcode: 0x4E, format: Format.G, operands: [rd, rs1, imm16], category: 'triple', description: 'Copy memory block', example: 'COPY R0, R1, 64' },
  { mnemonic: 'FILL', opcode: 0x4F, format: Format.G, operands: [rd, rs1, imm16], category: 'triple', description: 'Fill memory with value', example: 'FILL R0, R1, 64' },

  // ── Agent-to-Agent (0x50-0x5F) ──
  { mnemonic: 'TELL', opcode: 0x50, format: Format.E, operands: [rd, rs1, rs2], category: 'a2a', description: 'Send message to agent (one-way)', example: 'TELL R0, R1, R2' },
  { mnemonic: 'ASK', opcode: 0x51, format: Format.E, operands: [rd, rs1, rs2], category: 'a2a', description: 'Send request and await reply', example: 'ASK R0, R1, R2' },
  { mnemonic: 'DELEG', opcode: 0x52, format: Format.E, operands: [rd, rs1, rs2], category: 'a2a', description: 'Delegate task to another agent', example: 'DELEG R0, R1, R2' },
  { mnemonic: 'BCAST', opcode: 0x53, format: Format.E, operands: [rd, rs1, rs2], category: 'a2a', description: 'Broadcast to all connected agents', example: 'BCAST R0, R1, R2' },
  { mnemonic: 'ACCEPT', opcode: 0x54, format: Format.B, operands: [rd], category: 'a2a', description: 'Accept incoming connection', example: 'ACCEPT R0' },
  { mnemonic: 'DECLINE', opcode: 0x55, format: Format.B, operands: [rd], category: 'a2a', description: 'Decline incoming request', example: 'DECLINE R0' },
  { mnemonic: 'REPORT', opcode: 0x56, format: Format.E, operands: [rd, rs1, rs2], category: 'a2a', description: 'Report status to fleet coordinator', example: 'REPORT R0, R1, R2' },
  { mnemonic: 'MERGE', opcode: 0x57, format: Format.E, operands: [rd, rs1, rs2], category: 'a2a', description: 'Merge results from parallel agents', example: 'MERGE R0, R1, R2' },
  { mnemonic: 'FORK', opcode: 0x58, format: Format.B, operands: [rd], category: 'a2a', description: 'Fork execution to new agent', example: 'FORK R0' },
  { mnemonic: 'JOIN', opcode: 0x59, format: Format.B, operands: [rd], category: 'a2a', description: 'Join with forked agent', example: 'JOIN R0' },
  { mnemonic: 'SIGNAL', opcode: 0x5A, format: Format.C, operands: [imm8], category: 'a2a', description: 'Signal event to waiting agents', example: 'SIGNAL 0x01' },
  { mnemonic: 'AWAIT', opcode: 0x5B, format: Format.E, operands: [rd, rs1, rs2], category: 'a2a', description: 'Wait for signal on channel', example: 'AWAIT R0, R1, R2' },
  { mnemonic: 'TRUST', opcode: 0x5C, format: Format.E, operands: [rd, rs1, rs2], category: 'a2a', description: 'Update trust score for agent', example: 'TRUST R0, R1, R2' },
  { mnemonic: 'DISCOV', opcode: 0x5D, format: Format.B, operands: [rd], category: 'a2a', description: 'Discover available agents on network', example: 'DISCOV R0' },
  { mnemonic: 'STATUS', opcode: 0x5E, format: Format.B, operands: [rd], category: 'a2a', description: 'Query agent status', example: 'STATUS R0' },
  { mnemonic: 'HEARTBT', opcode: 0x5F, format: Format.B, operands: [rd], category: 'a2a', description: 'Send heartbeat keepalive', example: 'HEARTBT R0' },

  // ── Confidence-Aware (0x60-0x6F) ──
  { mnemonic: 'C_ADD', opcode: 0x60, format: Format.E, operands: [rd, rs1, rs2], category: 'confidence', description: 'Confidence-propagating addition', example: 'C_ADD R0, R1, R2' },
  { mnemonic: 'C_SUB', opcode: 0x61, format: Format.E, operands: [rd, rs1, rs2], category: 'confidence', description: 'Confidence-propagating subtraction', example: 'C_SUB R0, R1, R2' },
  { mnemonic: 'C_MUL', opcode: 0x62, format: Format.E, operands: [rd, rs1, rs2], category: 'confidence', description: 'Confidence-propagating multiplication', example: 'C_MUL R0, R1, R2' },
  { mnemonic: 'C_DIV', opcode: 0x63, format: Format.E, operands: [rd, rs1, rs2], category: 'confidence', description: 'Confidence-propagating division', example: 'C_DIV R0, R1, R2' },
  { mnemonic: 'C_FADD', opcode: 0x64, format: Format.E, operands: [rd, rs1, rs2], category: 'confidence', description: 'Confidence float addition', example: 'C_FADD R0, R1, R2' },
  { mnemonic: 'C_FSUB', opcode: 0x65, format: Format.E, operands: [rd, rs1, rs2], category: 'confidence', description: 'Confidence float subtraction', example: 'C_FSUB R0, R1, R2' },
  { mnemonic: 'C_FMUL', opcode: 0x66, format: Format.E, operands: [rd, rs1, rs2], category: 'confidence', description: 'Confidence float multiplication', example: 'C_FMUL R0, R1, R2' },
  { mnemonic: 'C_FDIV', opcode: 0x67, format: Format.E, operands: [rd, rs1, rs2], category: 'confidence', description: 'Confidence float division', example: 'C_FDIV R0, R1, R2' },
  { mnemonic: 'C_MERGE', opcode: 0x68, format: Format.E, operands: [rd, rs1, rs2], category: 'confidence', description: 'Merge confidence from multiple sources', example: 'C_MERGE R0, R1, R2' },
  { mnemonic: 'C_THRESH', opcode: 0x69, format: Format.D, operands: [rd, imm8], category: 'confidence', description: 'Apply confidence threshold filter', example: 'C_THRESH R0, 128' },
  { mnemonic: 'C_BOOST', opcode: 0x6A, format: Format.D, operands: [rd, imm8], category: 'confidence', description: 'Boost confidence by factor', example: 'C_BOOST R0, 10' },
  { mnemonic: 'C_DECAY', opcode: 0x6B, format: Format.D, operands: [rd, imm8], category: 'confidence', description: 'Apply time-based confidence decay', example: 'C_DECAY R0, 5' },
  { mnemonic: 'C_SOURCE', opcode: 0x6C, format: Format.D, operands: [rd, imm8], category: 'confidence', description: 'Tag confidence source (direct/inferred/report)', example: 'C_SOURCE R0, 0' },
  { mnemonic: 'C_CALIB', opcode: 0x6D, format: Format.D, operands: [rd, imm8], category: 'confidence', description: 'Calibrate confidence sensor', example: 'C_CALIB R0, 100' },
  { mnemonic: 'C_EXPLY', opcode: 0x6E, format: Format.E, operands: [rd, rs1, rs2], category: 'confidence', description: 'Explicit confidence annotation', example: 'C_EXPLY R0, R1, R2' },
  { mnemonic: 'C_VOTE', opcode: 0x6F, format: Format.E, operands: [rd, rs1, rs2], category: 'confidence', description: 'Weighted confidence vote across agents', example: 'C_VOTE R0, R1, R2' },

  // ── Viewpoint Operations (0x70-0x7F) — fence-0x42 shipped by Super Z ──
  { mnemonic: 'V_EVID', opcode: 0x70, format: Format.E, operands: [rd, rs1, rs2], category: 'viewpoint', description: 'Set evidentiality level (DIRECT/INFERRED/REPORTED)', example: 'V_EVID R0, R1, R2' },
  { mnemonic: 'V_EPIST', opcode: 0x71, format: Format.E, operands: [rd, rs1, rs2], category: 'viewpoint', description: 'Set epistemic stance (certain/probable/possible/doubtful)', example: 'V_EPIST R0, R1, R2' },
  { mnemonic: 'V_MIR', opcode: 0x72, format: Format.B, operands: [rd], category: 'viewpoint', description: 'Toggle mirativity (unexpected information marker)', example: 'V_MIR R0' },
  { mnemonic: 'V_NEG', opcode: 0x73, format: Format.B, operands: [rd], category: 'viewpoint', description: 'Toggle negation scope for viewpoint metadata', example: 'V_NEG R0' },
  { mnemonic: 'V_TENSE', opcode: 0x74, format: Format.D, operands: [rd, imm8], category: 'viewpoint', description: 'Set temporal reference (past/present/future)', example: 'V_TENSE R0, 0' },
  { mnemonic: 'V_ASPEC', opcode: 0x75, format: Format.D, operands: [rd, imm8], category: 'viewpoint', description: 'Set aspect (perfective/imperfective/progressive)', example: 'V_ASPEC R0, 1' },
  { mnemonic: 'V_MODAL', opcode: 0x76, format: Format.D, operands: [rd, imm8], category: 'viewpoint', description: 'Set modality (must/may/can/should)', example: 'V_MODAL R0, 2' },
  { mnemonic: 'V_POLIT', opcode: 0x77, format: Format.D, operands: [rd, imm8], category: 'viewpoint', description: 'Set politeness level (maps Korean 7-tier speech system)', example: 'V_POLIT R0, 3' },
  { mnemonic: 'V_HONOR', opcode: 0x78, format: Format.D, operands: [rd, imm8], category: 'viewpoint', description: 'Set honorific register (informal/formal/reverential)', example: 'V_HONOR R0, 0' },
  { mnemonic: 'V_TOPIC', opcode: 0x79, format: Format.B, operands: [rd], category: 'viewpoint', description: 'Mark topic/comment structure for discourse', example: 'V_TOPIC R0' },
  { mnemonic: 'V_FOCUS', opcode: 0x7A, format: Format.B, operands: [rd], category: 'viewpoint', description: 'Set information focus (contrastive/emphatic)', example: 'V_FOCUS R0' },
  { mnemonic: 'V_CASE', opcode: 0x7B, format: Format.D, operands: [rd, imm8], category: 'viewpoint', description: 'Set grammatical case (nominative/accusative/dative)', example: 'V_CASE R0, 1' },
  { mnemonic: 'V_AGREE', opcode: 0x7C, format: Format.D, operands: [rd, imm8], category: 'viewpoint', description: 'Set agreement features (person/number/gender)', example: 'V_AGREE R0, 0' },
  { mnemonic: 'V_CLASS', opcode: 0x7D, format: Format.D, operands: [rd, imm8], category: 'viewpoint', description: 'Set noun class (animacy/countability/etc.)', example: 'V_CLASS R0, 1' },
  { mnemonic: 'V_INFL', opcode: 0x7E, format: Format.E, operands: [rd, rs1, rs2], category: 'viewpoint', description: 'Apply inflection pattern from metadata plane', example: 'V_INFL R0, R1, R2' },
  { mnemonic: 'V_PRAGMA', opcode: 0x7F, format: Format.D, operands: [rd, imm8], category: 'viewpoint', description: 'Set viewpoint compiler pragma/flag', example: 'V_PRAGMA R0, 0xFF' },

  // ── Biology/Sensor (0x80-0x8F) ──
  { mnemonic: 'SENSE', opcode: 0x80, format: Format.E, operands: [rd, rs1, rs2], category: 'sensor', description: 'Read from sensor channel', example: 'SENSE R0, R1, R2' },
  { mnemonic: 'ACTUATE', opcode: 0x81, format: Format.E, operands: [rd, rs1, rs2], category: 'sensor', description: 'Write to actuator channel', example: 'ACTUATE R0, R1, R2' },
  { mnemonic: 'SAMPLE', opcode: 0x82, format: Format.D, operands: [rd, imm8], category: 'sensor', description: 'Sample sensor at frequency (Hz)', example: 'SAMPLE R0, 100' },
  { mnemonic: 'ENERGY', opcode: 0x83, format: Format.B, operands: [rd], category: 'sensor', description: 'Read energy level', example: 'ENERGY R0' },
  { mnemonic: 'TEMP', opcode: 0x84, format: Format.B, operands: [rd], category: 'sensor', description: 'Read temperature sensor', example: 'TEMP R0' },
  { mnemonic: 'GPS', opcode: 0x85, format: Format.B, operands: [rd], category: 'sensor', description: 'Read GPS coordinates', example: 'GPS R0' },
  { mnemonic: 'ACCEL', opcode: 0x86, format: Format.B, operands: [rd], category: 'sensor', description: 'Read accelerometer', example: 'ACCEL R0' },
  { mnemonic: 'DEPTH', opcode: 0x87, format: Format.B, operands: [rd], category: 'sensor', description: 'Read depth/pressure sensor', example: 'DEPTH R0' },
  { mnemonic: 'CAMCAP', opcode: 0x88, format: Format.B, operands: [rd], category: 'sensor', description: 'Capture camera frame', example: 'CAMCAP R0' },
  { mnemonic: 'CAMDET', opcode: 0x89, format: Format.B, operands: [rd], category: 'sensor', description: 'Run camera detection model', example: 'CAMDET R0' },
  { mnemonic: 'PWM', opcode: 0x8A, format: Format.D, operands: [rd, imm8], category: 'sensor', description: 'Set PWM duty cycle (0-255)', example: 'PWM R0, 128' },
  { mnemonic: 'GPIO', opcode: 0x8B, format: Format.D, operands: [rd, imm8], category: 'sensor', description: 'Read/write GPIO pin', example: 'GPIO R0, 5' },
  { mnemonic: 'I2C', opcode: 0x8C, format: Format.E, operands: [rd, rs1, rs2], category: 'sensor', description: 'I2C bus transaction', example: 'I2C R0, R1, R2' },
  { mnemonic: 'SPI', opcode: 0x8D, format: Format.E, operands: [rd, rs1, rs2], category: 'sensor', description: 'SPI bus transaction', example: 'SPI R0, R1, R2' },
  { mnemonic: 'UART', opcode: 0x8E, format: Format.E, operands: [rd, rs1, rs2], category: 'sensor', description: 'UART serial transaction', example: 'UART R0, R1, R2' },
  { mnemonic: 'CANBUS', opcode: 0x8F, format: Format.E, operands: [rd, rs1, rs2], category: 'sensor', description: 'CAN bus transaction', example: 'CANBUS R0, R1, R2' },

  // ── Extended Math/Crypto (0x90-0x9F) ──
  { mnemonic: 'ABS', opcode: 0x90, format: Format.B, operands: [rd], category: 'math_crypto', description: 'Absolute value', example: 'ABS R0' },
  { mnemonic: 'SIGN', opcode: 0x91, format: Format.B, operands: [rd], category: 'math_crypto', description: 'Sign function (-1, 0, or 1)', example: 'SIGN R0' },
  { mnemonic: 'SQRT', opcode: 0x92, format: Format.B, operands: [rd], category: 'math_crypto', description: 'Integer square root', example: 'SQRT R0' },
  { mnemonic: 'POW', opcode: 0x93, format: Format.E, operands: [rd, rs1, rs2], category: 'math_crypto', description: 'Power: rd = rs1 ^ rs2', example: 'POW R0, R1, R2' },
  { mnemonic: 'LOG2', opcode: 0x94, format: Format.B, operands: [rd], category: 'math_crypto', description: 'Base-2 logarithm', example: 'LOG2 R0' },
  { mnemonic: 'CLZ', opcode: 0x95, format: Format.B, operands: [rd], category: 'math_crypto', description: 'Count leading zeros', example: 'CLZ R0' },
  { mnemonic: 'CTZ', opcode: 0x96, format: Format.B, operands: [rd], category: 'math_crypto', description: 'Count trailing zeros', example: 'CTZ R0' },
  { mnemonic: 'POPCNT', opcode: 0x97, format: Format.B, operands: [rd], category: 'math_crypto', description: 'Population count (set bits)', example: 'POPCNT R0' },
  { mnemonic: 'CRC32', opcode: 0x98, format: Format.E, operands: [rd, rs1, rs2], category: 'math_crypto', description: 'CRC32 hash', example: 'CRC32 R0, R1, R2' },
  { mnemonic: 'SHA256', opcode: 0x99, format: Format.E, operands: [rd, rs1, rs2], category: 'math_crypto', description: 'SHA-256 hash', example: 'SHA256 R0, R1, R2' },
  { mnemonic: 'RND', opcode: 0x9A, format: Format.B, operands: [rd], category: 'math_crypto', description: 'Random number generation', example: 'RND R0' },
  { mnemonic: 'SEED', opcode: 0x9B, format: Format.D, operands: [rd, imm8], category: 'math_crypto', description: 'Seed random number generator', example: 'SEED R0, 42' },
  { mnemonic: 'FMOD', opcode: 0x9C, format: Format.E, operands: [rd, rs1, rs2], category: 'math_crypto', description: 'Float modulo', example: 'FMOD R0, R1, R2' },
  { mnemonic: 'FSQRT', opcode: 0x9D, format: Format.B, operands: [rd], category: 'math_crypto', description: 'Float square root', example: 'FSQRT R0' },
  { mnemonic: 'FSIN', opcode: 0x9E, format: Format.B, operands: [rd], category: 'math_crypto', description: 'Float sine', example: 'FSIN R0' },
  { mnemonic: 'FCOS', opcode: 0x9F, format: Format.B, operands: [rd], category: 'math_crypto', description: 'Float cosine', example: 'FCOS R0' },

  // ── String/Collection (0xA0-0xAF) ──
  { mnemonic: 'LEN', opcode: 0xA0, format: Format.B, operands: [rd], category: 'collection', description: 'Length of string or collection', example: 'LEN R0' },
  { mnemonic: 'CONCAT', opcode: 0xA1, format: Format.E, operands: [rd, rs1, rs2], category: 'collection', description: 'String concatenation', example: 'CONCAT R0, R1, R2' },
  { mnemonic: 'AT', opcode: 0xA2, format: Format.E, operands: [rd, rs1, rs2], category: 'collection', description: 'Index into collection: rd = coll[rs1]', example: 'AT R0, R1, R2' },
  { mnemonic: 'SETAT', opcode: 0xA3, format: Format.E, operands: [rd, rs1, rs2], category: 'collection', description: 'Set element at index', example: 'SETAT R0, R1, R2' },
  { mnemonic: 'SLICE', opcode: 0xA4, format: Format.E, operands: [rd, rs1, rs2], category: 'collection', description: 'Slice collection [rs1:rs2]', example: 'SLICE R0, R1, R2' },
  { mnemonic: 'REDUCE', opcode: 0xA5, format: Format.E, operands: [rd, rs1, rs2], category: 'collection', description: 'Reduce collection with accumulator', example: 'REDUCE R0, R1, R2' },
  { mnemonic: 'MAP', opcode: 0xA6, format: Format.E, operands: [rd, rs1, rs2], category: 'collection', description: 'Map function over collection', example: 'MAP R0, R1, R2' },
  { mnemonic: 'FILTER', opcode: 0xA7, format: Format.E, operands: [rd, rs1, rs2], category: 'collection', description: 'Filter collection by predicate', example: 'FILTER R0, R1, R2' },
  { mnemonic: 'SORT', opcode: 0xA8, format: Format.B, operands: [rd], category: 'collection', description: 'Sort collection in place', example: 'SORT R0' },
  { mnemonic: 'FIND', opcode: 0xA9, format: Format.E, operands: [rd, rs1, rs2], category: 'collection', description: 'Find element in collection', example: 'FIND R0, R1, R2' },
  { mnemonic: 'HASH', opcode: 0xAA, format: Format.B, operands: [rd], category: 'collection', description: 'Hash value', example: 'HASH R0' },
  { mnemonic: 'HMAC', opcode: 0xAB, format: Format.E, operands: [rd, rs1, rs2], category: 'collection', description: 'HMAC authentication code', example: 'HMAC R0, R1, R2' },
  { mnemonic: 'VERIFY', opcode: 0xAC, format: Format.E, operands: [rd, rs1, rs2], category: 'collection', description: 'Verify signature/hash', example: 'VERIFY R0, R1, R2' },
  { mnemonic: 'ENCRYPT', opcode: 0xAD, format: Format.E, operands: [rd, rs1, rs2], category: 'collection', description: 'Encrypt data', example: 'ENCRYPT R0, R1, R2' },
  { mnemonic: 'DECRYPT', opcode: 0xAE, format: Format.E, operands: [rd, rs1, rs2], category: 'collection', description: 'Decrypt data', example: 'DECRYPT R0, R1, R2' },
  { mnemonic: 'KEYGEN', opcode: 0xAF, format: Format.B, operands: [rd], category: 'collection', description: 'Generate encryption key', example: 'KEYGEN R0' },

  // ── Vector/SIMD (0xB0-0xBF) ──
  { mnemonic: 'VLOAD', opcode: 0xB0, format: Format.E, operands: [{ type: OperandType.VREG, name: 'vd', description: 'Vector destination' }, rs1, rs2], category: 'vector', description: 'Load vector from memory', example: 'VLOAD V0, R0, R1' },
  { mnemonic: 'VSTORE', opcode: 0xB1, format: Format.E, operands: [{ type: OperandType.VREG, name: 'vd', description: 'Vector source' }, rs1, rs2], category: 'vector', description: 'Store vector to memory', example: 'VSTORE V0, R0, R1' },
  { mnemonic: 'VADD', opcode: 0xB2, format: Format.E, operands: [{ type: OperandType.VREG, name: 'vd', description: 'Vector dest' }, { type: OperandType.VREG, name: 'vs1', description: 'Vector src 1' }, { type: OperandType.VREG, name: 'vs2', description: 'Vector src 2' }], category: 'vector', description: 'Vector element-wise add', example: 'VADD V0, V1, V2' },
  { mnemonic: 'VMUL', opcode: 0xB3, format: Format.E, operands: [{ type: OperandType.VREG, name: 'vd', description: 'Vector dest' }, { type: OperandType.VREG, name: 'vs1', description: 'Vector src 1' }, { type: OperandType.VREG, name: 'vs2', description: 'Vector src 2' }], category: 'vector', description: 'Vector element-wise multiply', example: 'VMUL V0, V1, V2' },
  { mnemonic: 'VDOT', opcode: 0xB4, format: Format.E, operands: [{ type: OperandType.VREG, name: 'vd', description: 'Vector dest' }, { type: OperandType.VREG, name: 'vs1', description: 'Vector src 1' }, { type: OperandType.VREG, name: 'vs2', description: 'Vector src 2' }], category: 'vector', description: 'Vector dot product', example: 'VDOT V0, V1, V2' },
  { mnemonic: 'VNORM', opcode: 0xB5, format: Format.B, operands: [{ type: OperandType.VREG, name: 'vd', description: 'Vector dest' }], category: 'vector', description: 'Vector normalization', example: 'VNORM V0' },
  { mnemonic: 'VSCALE', opcode: 0xB6, format: Format.E, operands: [{ type: OperandType.VREG, name: 'vd', description: 'Vector dest' }, { type: OperandType.VREG, name: 'vs1', description: 'Vector src' }, rs2], category: 'vector', description: 'Scale vector by scalar', example: 'VSCALE V0, V1, R0' },
  { mnemonic: 'VMAXP', opcode: 0xB7, format: Format.B, operands: [{ type: OperandType.VREG, name: 'vd', description: 'Vector dest' }], category: 'vector', description: 'Vector horizontal max', example: 'VMAXP V0' },
  { mnemonic: 'VMINP', opcode: 0xB8, format: Format.B, operands: [{ type: OperandType.VREG, name: 'vd', description: 'Vector dest' }], category: 'vector', description: 'Vector horizontal min', example: 'VMINP V0' },
  { mnemonic: 'VREDUCE', opcode: 0xB9, format: Format.E, operands: [rd, { type: OperandType.VREG, name: 'vs', description: 'Vector source' }, rs2], category: 'vector', description: 'Reduce vector to scalar', example: 'VREDUCE R0, V0, R1' },
  { mnemonic: 'VGATHER', opcode: 0xBA, format: Format.E, operands: [{ type: OperandType.VREG, name: 'vd', description: 'Vector dest' }, rs1, rs2], category: 'vector', description: 'Gather-scatter load', example: 'VGATHER V0, R0, R1' },
  { mnemonic: 'VSCATTER', opcode: 0xBB, format: Format.E, operands: [{ type: OperandType.VREG, name: 'vd', description: 'Vector source' }, rs1, rs2], category: 'vector', description: 'Scatter-store', example: 'VSCATTER V0, R0, R1' },
  { mnemonic: 'VSHUF', opcode: 0xBC, format: Format.E, operands: [{ type: OperandType.VREG, name: 'vd', description: 'Vector dest' }, { type: OperandType.VREG, name: 'vs1', description: 'Vector src 1' }, { type: OperandType.VREG, name: 'vs2', description: 'Vector src 2' }], category: 'vector', description: 'Shuffle vector elements', example: 'VSHUF V0, V1, V2' },
  { mnemonic: 'VMERGE', opcode: 0xBD, format: Format.E, operands: [{ type: OperandType.VREG, name: 'vd', description: 'Vector dest' }, { type: OperandType.VREG, name: 'vs1', description: 'Vector src 1' }, { type: OperandType.VREG, name: 'vs2', description: 'Vector src 2' }], category: 'vector', description: 'Conditional merge', example: 'VMERGE V0, V1, V2' },
  { mnemonic: 'VCONF', opcode: 0xBE, format: Format.B, operands: [{ type: OperandType.VREG, name: 'vd', description: 'Vector dest' }], category: 'vector', description: 'Vector confidence annotation', example: 'VCONF V0' },
  { mnemonic: 'VSELECT', opcode: 0xBF, format: Format.E, operands: [{ type: OperandType.VREG, name: 'vd', description: 'Vector dest' }, { type: OperandType.VREG, name: 'vs1', description: 'Vector src 1' }, rs2], category: 'vector', description: 'Conditional vector select', example: 'VSELECT V0, V1, R0' },

  // ── Tensor/Neural (0xC0-0xCF) ──
  { mnemonic: 'TMATMUL', opcode: 0xC0, format: Format.E, operands: [rd, rs1, rs2], category: 'tensor', description: 'Tensor matrix multiplication', example: 'TMATMUL R0, R1, R2' },
  { mnemonic: 'TCONV', opcode: 0xC1, format: Format.E, operands: [rd, rs1, rs2], category: 'tensor', description: 'Tensor convolution', example: 'TCONV R0, R1, R2' },
  { mnemonic: 'TPOOL', opcode: 0xC2, format: Format.E, operands: [rd, rs1, rs2], category: 'tensor', description: 'Tensor pooling (max/avg)', example: 'TPOOL R0, R1, R2' },
  { mnemonic: 'TRELU', opcode: 0xC3, format: Format.B, operands: [rd], category: 'tensor', description: 'ReLU activation', example: 'TRELU R0' },
  { mnemonic: 'TSIGM', opcode: 0xC4, format: Format.B, operands: [rd], category: 'tensor', description: 'Sigmoid activation', example: 'TSIGM R0' },
  { mnemonic: 'TSOFT', opcode: 0xC5, format: Format.B, operands: [rd], category: 'tensor', description: 'Softmax activation', example: 'TSOFT R0' },
  { mnemonic: 'TLOSS', opcode: 0xC6, format: Format.E, operands: [rd, rs1, rs2], category: 'tensor', description: 'Compute loss function', example: 'TLOSS R0, R1, R2' },
  { mnemonic: 'TGRAD', opcode: 0xC7, format: Format.E, operands: [rd, rs1, rs2], category: 'tensor', description: 'Compute gradient', example: 'TGRAD R0, R1, R2' },
  { mnemonic: 'TUPDATE', opcode: 0xC8, format: Format.E, operands: [rd, rs1, rs2], category: 'tensor', description: 'Update weights (gradient descent step)', example: 'TUPDATE R0, R1, R2' },
  { mnemonic: 'TADAM', opcode: 0xC9, format: Format.E, operands: [rd, rs1, rs2], category: 'tensor', description: 'Adam optimizer update', example: 'TADAM R0, R1, R2' },
  { mnemonic: 'TEMBED', opcode: 0xCA, format: Format.E, operands: [rd, rs1, rs2], category: 'tensor', description: 'Lookup embedding vector', example: 'TEMBED R0, R1, R2' },
  { mnemonic: 'TATTN', opcode: 0xCB, format: Format.E, operands: [rd, rs1, rs2], category: 'tensor', description: 'Self-attention computation', example: 'TATTN R0, R1, R2' },
  { mnemonic: 'TSAMPLE', opcode: 0xCC, format: Format.B, operands: [rd], category: 'tensor', description: 'Sample from distribution', example: 'TSAMPLE R0' },
  { mnemonic: 'TTOKEN', opcode: 0xCD, format: Format.B, operands: [rd], category: 'tensor', description: 'Tokenize input', example: 'TTOKEN R0' },
  { mnemonic: 'TDETOK', opcode: 0xCE, format: Format.B, operands: [rd], category: 'tensor', description: 'Detokenize to text', example: 'TDETOK R0' },
  { mnemonic: 'TQUANT', opcode: 0xCF, format: Format.B, operands: [rd], category: 'tensor', description: 'Quantize tensor', example: 'TQUANT R0' },

  // ── Extended Memory/I-O (0xD0-0xDF) ──
  { mnemonic: 'DMA_CPY', opcode: 0xD0, format: Format.E, operands: [rd, rs1, rs2], category: 'memory_io', description: 'DMA memory copy', example: 'DMA_CPY R0, R1, R2' },
  { mnemonic: 'DMA_SET', opcode: 0xD1, format: Format.E, operands: [rd, rs1, rs2], category: 'memory_io', description: 'DMA memory set (fill)', example: 'DMA_SET R0, R1, R2' },
  { mnemonic: 'MMIO_R', opcode: 0xD2, format: Format.E, operands: [rd, rs1, rs2], category: 'memory_io', description: 'Memory-mapped I/O read', example: 'MMIO_R R0, R1, R2' },
  { mnemonic: 'MMIO_W', opcode: 0xD3, format: Format.E, operands: [rd, rs1, rs2], category: 'memory_io', description: 'Memory-mapped I/O write', example: 'MMIO_W R0, R1, R2' },
  { mnemonic: 'ATOMIC', opcode: 0xD4, format: Format.E, operands: [rd, rs1, rs2], category: 'memory_io', description: 'Atomic operation', example: 'ATOMIC R0, R1, R2' },
  { mnemonic: 'CAS', opcode: 0xD5, format: Format.E, operands: [rd, rs1, rs2], category: 'memory_io', description: 'Compare-and-swap', example: 'CAS R0, R1, R2' },
  { mnemonic: 'FENCE', opcode: 0xD6, format: Format.A, operands: [none], category: 'memory_io', description: 'Memory fence (ordering barrier)', example: 'FENCE' },
  { mnemonic: 'MALLOC', opcode: 0xD7, format: Format.B, operands: [rd], category: 'memory_io', description: 'Allocate memory block', example: 'MALLOC R0' },
  { mnemonic: 'FREE', opcode: 0xD8, format: Format.B, operands: [rd], category: 'memory_io', description: 'Free memory block', example: 'FREE R0' },
  { mnemonic: 'MPROT', opcode: 0xD9, format: Format.D, operands: [rd, imm8], category: 'memory_io', description: 'Set memory protection flags', example: 'MPROT R0, 3' },
  { mnemonic: 'MCACHE', opcode: 0xDA, format: Format.A, operands: [none], category: 'memory_io', description: 'Memory cache flush', example: 'MCACHE' },
  { mnemonic: 'GPU_LD', opcode: 0xDB, format: Format.E, operands: [rd, rs1, rs2], category: 'memory_io', description: 'Load from GPU memory', example: 'GPU_LD R0, R1, R2' },
  { mnemonic: 'GPU_ST', opcode: 0xDC, format: Format.E, operands: [rd, rs1, rs2], category: 'memory_io', description: 'Store to GPU memory', example: 'GPU_ST R0, R1, R2' },
  { mnemonic: 'GPU_EX', opcode: 0xDD, format: Format.B, operands: [rd], category: 'memory_io', description: 'Execute on GPU', example: 'GPU_EX R0' },
  { mnemonic: 'GPU_SYNC', opcode: 0xDE, format: Format.A, operands: [none], category: 'memory_io', description: 'Synchronize GPU operations', example: 'GPU_SYNC' },

  // ── Long Jumps/Calls (0xE0-0xEF) ──
  { mnemonic: 'JMPL', opcode: 0xE0, format: Format.F, operands: [rd, imm16], category: 'long_jump', description: 'Long jump (32-bit offset)', example: 'JMPL R0, @far_label' },
  { mnemonic: 'JALL', opcode: 0xE1, format: Format.F, operands: [rd, imm16], category: 'long_jump', description: 'Long jump and link', example: 'JALL LR, @far_fn' },
  { mnemonic: 'CALLL', opcode: 0xE2, format: Format.F, operands: [rd, imm16], category: 'long_jump', description: 'Long call (32-bit offset)', example: 'CALLL LR, @far_fn' },
  { mnemonic: 'TAIL', opcode: 0xE3, format: Format.F, operands: [rd, imm16], category: 'long_jump', description: 'Tail call optimization', example: 'TAIL R0, @fn' },
  { mnemonic: 'SWITCH', opcode: 0xE4, format: Format.F, operands: [rd, imm16], category: 'long_jump', description: 'Switch/jump table dispatch', example: 'SWITCH R0, @table' },
  { mnemonic: 'COYIELD', opcode: 0xE5, format: Format.A, operands: [none], category: 'long_jump', description: 'Coroutine yield', example: 'COYIELD' },
  { mnemonic: 'CORESUM', opcode: 0xE6, format: Format.A, operands: [none], category: 'long_jump', description: 'Core summary/statistics', example: 'CORESUM' },
  { mnemonic: 'FAULT', opcode: 0xE7, format: Format.C, operands: [imm8], category: 'long_jump', description: 'Trigger fault with code', example: 'FAULT 1' },
  { mnemonic: 'HANDLER', opcode: 0xE8, format: Format.F, operands: [rd, imm16], category: 'long_jump', description: 'Register fault handler', example: 'HANDLER R0, @handler' },
  { mnemonic: 'TRACE', opcode: 0xE9, format: Format.B, operands: [rd], category: 'long_jump', description: 'Enable execution trace', example: 'TRACE R0' },
  { mnemonic: 'PROF_ON', opcode: 0xEA, format: Format.A, operands: [none], category: 'long_jump', description: 'Enable profiling', example: 'PROF_ON' },
  { mnemonic: 'PROF_OFF', opcode: 0xEB, format: Format.A, operands: [none], category: 'long_jump', description: 'Disable profiling', example: 'PROF_OFF' },
  { mnemonic: 'WATCH', opcode: 0xEC, format: Format.E, operands: [rd, rs1, rs2], category: 'long_jump', description: 'Set memory watchpoint', example: 'WATCH R0, R1, R2' },

  // ── Extended System/Debug (0xF0-0xFF) ──
  { mnemonic: 'HALT_ERR', opcode: 0xF0, format: Format.A, operands: [none], category: 'ext_system', description: 'Halt with error', example: 'HALT_ERR' },
  { mnemonic: 'REBOOT', opcode: 0xF1, format: Format.A, operands: [none], category: 'ext_system', description: 'Reboot the VM', example: 'REBOOT' },
  { mnemonic: 'DUMP', opcode: 0xF2, format: Format.B, operands: [rd], category: 'ext_system', description: 'Dump register state', example: 'DUMP R0' },
  { mnemonic: 'ASSERT', opcode: 0xF3, format: Format.A, operands: [none], category: 'ext_system', description: 'Assert condition (halt if false)', example: 'ASSERT' },
  { mnemonic: 'ID', opcode: 0xF4, format: Format.B, operands: [rd], category: 'ext_system', description: 'Agent/VM identifier', example: 'ID R0' },
  { mnemonic: 'VER', opcode: 0xF5, format: Format.A, operands: [none], category: 'ext_system', description: 'VM version query', example: 'VER' },
  { mnemonic: 'CLK', opcode: 0xF6, format: Format.B, operands: [rd], category: 'ext_system', description: 'Read clock/cycle counter', example: 'CLK R0' },
  { mnemonic: 'PCLK', opcode: 0xF7, format: Format.B, operands: [rd], category: 'ext_system', description: 'Read physical clock', example: 'PCLK R0' },
  { mnemonic: 'WDOG', opcode: 0xF8, format: Format.D, operands: [rd, imm8], category: 'ext_system', description: 'Watchdog timer configuration', example: 'WDOG R0, 100' },
  { mnemonic: 'SLEEP', opcode: 0xF9, format: Format.C, operands: [imm8], category: 'ext_system', description: 'Sleep for N cycles', example: 'SLEEP 1000' },
  { mnemonic: 'ILLEGAL', opcode: 0xFF, format: Format.A, operands: [none], category: 'ext_system', description: 'Illegal instruction (catch-all)', example: 'ILLEGAL' },
];

// ─── Lookup Maps ───

/** Mnemonic → opcode entry (case-insensitive lookup) */
export const MNEMONIC_MAP = new Map<string, OpcodeEntry>(
  OPCODES.map(op => [op.mnemonic, op])
);

/** Opcode value → entry */
export const OPCODE_VALUE_MAP = new Map<number, OpcodeEntry>(
  OPCODES.filter(op => op.opcode <= 0xFF).map(op => [op.opcode, op])
);

/** Get opcodes by category */
export function opcodesByCategory(category: OpcodeCategory): OpcodeEntry[] {
  return OPCODES.filter(op => op.category === category);
}

/** Check if a string is a valid mnemonic */
export function isValidMnemonic(s: string): boolean {
  return MNEMONIC_MAP.has(s.toUpperCase());
}

/** Look up mnemonic (case-insensitive) */
export function lookupMnemonic(s: string): OpcodeEntry | undefined {
  return MNEMONIC_MAP.get(s.toUpperCase());
}
