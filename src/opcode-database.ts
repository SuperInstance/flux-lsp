/**
 * FLUX Opcode Database — Complete reference data for all FLUX ISA opcodes.
 *
 * Source: ISA_UNIFIED.md — 247 defined opcodes across Formats A-G.
 * Organized by functional domain with full encoding, description, and operand info.
 */

import {
    CompletionItem,
    CompletionItemKind,
    InsertTextFormat,
} from 'vscode-languageserver';

// ─── Types ───────────────────────────────────────────────────────────────────

export type FormatType = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export type OperandRole = 'rd' | 'rs1' | 'rs2' | 'imm8' | 'imm16' | '-';

export interface OperandInfo {
    role: OperandRole;
    description: string;
}

export interface OpcodeInfo {
    mnemonic: string;
    opcode: number;
    format: FormatType;
    description: string;
    category: string;
    operands: OperandInfo[];
    implemented: boolean; // true = verified in conformance tests
}

// ─── Data ────────────────────────────────────────────────────────────────────

const RAW_OPCODES: OpcodeInfo[] = [
    // System Control (0x00–0x07) — Format A
    { mnemonic: 'HALT',     opcode: 0x00, format: 'A', description: 'Stop execution',                                             category: 'system',      operands: [],                                   implemented: true  },
    { mnemonic: 'NOP',      opcode: 0x01, format: 'A', description: 'No operation (pipeline sync)',                              category: 'system',      operands: [],                                   implemented: true  },
    { mnemonic: 'RET',      opcode: 0x02, format: 'A', description: 'Return from subroutine',                                    category: 'system',      operands: [],                                   implemented: false },
    { mnemonic: 'IRET',     opcode: 0x03, format: 'A', description: 'Return from interrupt handler',                             category: 'system',      operands: [],                                   implemented: false },
    { mnemonic: 'BRK',      opcode: 0x04, format: 'A', description: 'Breakpoint (trap to debugger)',                             category: 'debug',       operands: [],                                   implemented: true  },
    { mnemonic: 'WFI',      opcode: 0x05, format: 'A', description: 'Wait for interrupt (low-power idle)',                       category: 'system',      operands: [],                                   implemented: false },
    { mnemonic: 'RESET',    opcode: 0x06, format: 'A', description: 'Soft reset of register file',                               category: 'system',      operands: [],                                   implemented: false },
    { mnemonic: 'SYN',      opcode: 0x07, format: 'A', description: 'Memory barrier / synchronize',                              category: 'system',      operands: [],                                   implemented: false },

    // Single Register (0x08–0x0F) — Format B
    { mnemonic: 'INC',     opcode: 0x08, format: 'B', description: 'rd = rd + 1',                  category: 'arithmetic',  operands: [{ role: 'rd', description: 'destination register' }], implemented: true },
    { mnemonic: 'DEC',     opcode: 0x09, format: 'B', description: 'rd = rd - 1',                  category: 'arithmetic',  operands: [{ role: 'rd', description: 'destination register' }], implemented: true },
    { mnemonic: 'NOT',     opcode: 0x0A, format: 'B', description: 'rd = ~rd (bitwise NOT)',        category: 'arithmetic',  operands: [{ role: 'rd', description: 'destination register' }], implemented: true },
    { mnemonic: 'NEG',     opcode: 0x0B, format: 'B', description: 'rd = -rd (arithmetic negate)',   category: 'arithmetic',  operands: [{ role: 'rd', description: 'destination register' }], implemented: true },
    { mnemonic: 'PUSH',    opcode: 0x0C, format: 'B', description: 'Push rd onto stack',            category: 'stack',       operands: [{ role: 'rd', description: 'source register' }],       implemented: true },
    { mnemonic: 'POP',     opcode: 0x0D, format: 'B', description: 'Pop stack into rd',             category: 'stack',       operands: [{ role: 'rd', description: 'destination register' }], implemented: true },
    { mnemonic: 'CONF_LD', opcode: 0x0E, format: 'B', description: 'Load confidence register rd to accumulator', category: 'confidence', operands: [{ role: 'rd', description: 'confidence register' }], implemented: true },
    { mnemonic: 'CONF_ST', opcode: 0x0F, format: 'B', description: 'Store confidence accumulator to register rd', category: 'confidence', operands: [{ role: 'rd', description: 'confidence register' }], implemented: true },

    // Immediate Only (0x10–0x17) — Format C
    { mnemonic: 'SYS',     opcode: 0x10, format: 'C', description: 'System call with code imm8',    category: 'system',      operands: [{ role: 'imm8', description: 'system call number' }],   implemented: true },
    { mnemonic: 'TRAP',    opcode: 0x11, format: 'C', description: 'Software interrupt vector imm8', category: 'system',      operands: [{ role: 'imm8', description: 'interrupt vector' }],     implemented: false },
    { mnemonic: 'DBG',     opcode: 0x12, format: 'C', description: 'Debug print register imm8',     category: 'debug',       operands: [{ role: 'imm8', description: 'register to print' }],    implemented: true },
    { mnemonic: 'CLF',     opcode: 0x13, format: 'C', description: 'Clear flags register bits imm8',category: 'system',      operands: [{ role: 'imm8', description: 'flag bitmask' }],        implemented: false },
    { mnemonic: 'SEMA',    opcode: 0x14, format: 'C', description: 'Semaphore operation imm8',      category: 'concurrency', operands: [{ role: 'imm8', description: 'semaphore ID' }],        implemented: false },
    { mnemonic: 'YIELD',   opcode: 0x15, format: 'C', description: 'Yield execution for imm8 cycles',category: 'concurrency',operands: [{ role: 'imm8', description: 'yield cycles' }],       implemented: true },
    { mnemonic: 'CACHE',   opcode: 0x16, format: 'C', description: 'Cache control (flush/invalidate by imm8)', category: 'system', operands: [{ role: 'imm8', description: 'cache operation' }], implemented: false },
    { mnemonic: 'STRIPCF', opcode: 0x17, format: 'C', description: 'Strip confidence from next imm8 ops', category: 'confidence', operands: [{ role: 'imm8', description: 'count of ops' }], implemented: false },

    // Register + Imm8 (0x18–0x1F) — Format D
    { mnemonic: 'MOVI',  opcode: 0x18, format: 'D', description: 'rd = sign_extend(imm8)',           category: 'move',       operands: [{ role: 'rd', description: 'destination' },   { role: 'imm8', description: 'immediate value' }], implemented: true },
    { mnemonic: 'ADDI',  opcode: 0x19, format: 'D', description: 'rd = rd + imm8',                  category: 'arithmetic',  operands: [{ role: 'rd', description: 'destination' },   { role: 'imm8', description: 'immediate value' }], implemented: true },
    { mnemonic: 'SUBI',  opcode: 0x1A, format: 'D', description: 'rd = rd - imm8',                  category: 'arithmetic',  operands: [{ role: 'rd', description: 'destination' },   { role: 'imm8', description: 'immediate value' }], implemented: true },
    { mnemonic: 'ANDI',  opcode: 0x1B, format: 'D', description: 'rd = rd & imm8',                  category: 'logic',       operands: [{ role: 'rd', description: 'destination' },   { role: 'imm8', description: 'immediate value' }], implemented: true },
    { mnemonic: 'ORI',   opcode: 0x1C, format: 'D', description: 'rd = rd | imm8',                  category: 'logic',       operands: [{ role: 'rd', description: 'destination' },   { role: 'imm8', description: 'immediate value' }], implemented: true },
    { mnemonic: 'XORI',  opcode: 0x1D, format: 'D', description: 'rd = rd ^ imm8',                  category: 'logic',       operands: [{ role: 'rd', description: 'destination' },   { role: 'imm8', description: 'immediate value' }], implemented: true },
    { mnemonic: 'SHLI',  opcode: 0x1E, format: 'D', description: 'rd = rd << imm8',                 category: 'shift',       operands: [{ role: 'rd', description: 'destination' },   { role: 'imm8', description: 'shift amount' }],    implemented: true },
    { mnemonic: 'SHRI',  opcode: 0x1F, format: 'D', description: 'rd = rd >> imm8',                 category: 'shift',       operands: [{ role: 'rd', description: 'destination' },   { role: 'imm8', description: 'shift amount' }],    implemented: true },

    // Integer Arithmetic (0x20–0x2F) — Format E
    { mnemonic: 'ADD',    opcode: 0x20, format: 'E', description: 'rd = rs1 + rs2',                  category: 'arithmetic', operands: [{ role: 'rd', description: 'destination' },  { role: 'rs1', description: 'source 1' }, { role: 'rs2', description: 'source 2' }], implemented: true },
    { mnemonic: 'SUB',    opcode: 0x21, format: 'E', description: 'rd = rs1 - rs2',                  category: 'arithmetic', operands: [{ role: 'rd', description: 'destination' },  { role: 'rs1', description: 'source 1' }, { role: 'rs2', description: 'source 2' }], implemented: true },
    { mnemonic: 'MUL',    opcode: 0x22, format: 'E', description: 'rd = rs1 * rs2',                  category: 'arithmetic', operands: [{ role: 'rd', description: 'destination' },  { role: 'rs1', description: 'source 1' }, { role: 'rs2', description: 'source 2' }], implemented: true },
    { mnemonic: 'DIV',    opcode: 0x23, format: 'E', description: 'rd = rs1 / rs2 (signed)',         category: 'arithmetic', operands: [{ role: 'rd', description: 'destination' },  { role: 'rs1', description: 'source 1' }, { role: 'rs2', description: 'source 2' }], implemented: true },
    { mnemonic: 'MOD',    opcode: 0x24, format: 'E', description: 'rd = rs1 % rs2',                  category: 'arithmetic', operands: [{ role: 'rd', description: 'destination' },  { role: 'rs1', description: 'source 1' }, { role: 'rs2', description: 'source 2' }], implemented: true },
    { mnemonic: 'AND',    opcode: 0x25, format: 'E', description: 'rd = rs1 & rs2',                  category: 'logic',      operands: [{ role: 'rd', description: 'destination' },  { role: 'rs1', description: 'source 1' }, { role: 'rs2', description: 'source 2' }], implemented: true },
    { mnemonic: 'OR',     opcode: 0x26, format: 'E', description: 'rd = rs1 | rs2',                  category: 'logic',      operands: [{ role: 'rd', description: 'destination' },  { role: 'rs1', description: 'source 1' }, { role: 'rs2', description: 'source 2' }], implemented: true },
    { mnemonic: 'XOR',    opcode: 0x27, format: 'E', description: 'rd = rs1 ^ rs2',                  category: 'logic',      operands: [{ role: 'rd', description: 'destination' },  { role: 'rs1', description: 'source 1' }, { role: 'rs2', description: 'source 2' }], implemented: true },
    { mnemonic: 'SHL',    opcode: 0x28, format: 'E', description: 'rd = rs1 << rs2',                 category: 'shift',      operands: [{ role: 'rd', description: 'destination' },  { role: 'rs1', description: 'source 1' }, { role: 'rs2', description: 'source 2' }], implemented: true },
    { mnemonic: 'SHR',    opcode: 0x29, format: 'E', description: 'rd = rs1 >> rs2',                 category: 'shift',      operands: [{ role: 'rd', description: 'destination' },  { role: 'rs1', description: 'source 1' }, { role: 'rs2', description: 'source 2' }], implemented: true },
    { mnemonic: 'MIN',    opcode: 0x2A, format: 'E', description: 'rd = min(rs1, rs2)',              category: 'arithmetic', operands: [{ role: 'rd', description: 'destination' },  { role: 'rs1', description: 'source 1' }, { role: 'rs2', description: 'source 2' }], implemented: true },
    { mnemonic: 'MAX',    opcode: 0x2B, format: 'E', description: 'rd = max(rs1, rs2)',              category: 'arithmetic', operands: [{ role: 'rd', description: 'destination' },  { role: 'rs1', description: 'source 1' }, { role: 'rs2', description: 'source 2' }], implemented: true },
    { mnemonic: 'CMP_EQ', opcode: 0x2C, format: 'E', description: 'rd = (rs1 == rs2) ? 1 : 0',       category: 'compare',    operands: [{ role: 'rd', description: 'destination' },  { role: 'rs1', description: 'source 1' }, { role: 'rs2', description: 'source 2' }], implemented: true },
    { mnemonic: 'CMP_LT', opcode: 0x2D, format: 'E', description: 'rd = (rs1 < rs2) ? 1 : 0',        category: 'compare',    operands: [{ role: 'rd', description: 'destination' },  { role: 'rs1', description: 'source 1' }, { role: 'rs2', description: 'source 2' }], implemented: true },
    { mnemonic: 'CMP_GT', opcode: 0x2E, format: 'E', description: 'rd = (rs1 > rs2) ? 1 : 0',        category: 'compare',    operands: [{ role: 'rd', description: 'destination' },  { role: 'rs1', description: 'source 1' }, { role: 'rs2', description: 'source 2' }], implemented: true },
    { mnemonic: 'CMP_NE', opcode: 0x2F, format: 'E', description: 'rd = (rs1 != rs2) ? 1 : 0',       category: 'compare',    operands: [{ role: 'rd', description: 'destination' },  { role: 'rs1', description: 'source 1' }, { role: 'rs2', description: 'source 2' }], implemented: true },

    // Float, Memory, Control (0x30–0x3F) — Format E
    { mnemonic: 'FADD', opcode: 0x30, format: 'E', description: 'rd = f(rs1) + f(rs2)',               category: 'float',   operands: [{ role: 'rd', description: 'destination' },  { role: 'rs1', description: 'source 1' }, { role: 'rs2', description: 'source 2' }], implemented: false },
    { mnemonic: 'FSUB', opcode: 0x31, format: 'E', description: 'rd = f(rs1) - f(rs2)',               category: 'float',   operands: [{ role: 'rd', description: 'destination' },  { role: 'rs1', description: 'source 1' }, { role: 'rs2', description: 'source 2' }], implemented: false },
    { mnemonic: 'FMUL', opcode: 0x32, format: 'E', description: 'rd = f(rs1) * f(rs2)',               category: 'float',   operands: [{ role: 'rd', description: 'destination' },  { role: 'rs1', description: 'source 1' }, { role: 'rs2', description: 'source 2' }], implemented: false },
    { mnemonic: 'FDIV', opcode: 0x33, format: 'E', description: 'rd = f(rs1) / f(rs2)',               category: 'float',   operands: [{ role: 'rd', description: 'destination' },  { role: 'rs1', description: 'source 1' }, { role: 'rs2', description: 'source 2' }], implemented: false },
    { mnemonic: 'FMIN', opcode: 0x34, format: 'E', description: 'rd = fmin(rs1, rs2)',                category: 'float',   operands: [{ role: 'rd', description: 'destination' },  { role: 'rs1', description: 'source 1' }, { role: 'rs2', description: 'source 2' }], implemented: false },
    { mnemonic: 'FMAX', opcode: 0x35, format: 'E', description: 'rd = fmax(rs1, rs2)',                category: 'float',   operands: [{ role: 'rd', description: 'destination' },  { role: 'rs1', description: 'source 1' }, { role: 'rs2', description: 'source 2' }], implemented: false },
    { mnemonic: 'FTOI', opcode: 0x36, format: 'E', description: 'rd = int(f(rs1))',                   category: 'convert', operands: [{ role: 'rd', description: 'destination' },  { role: 'rs1', description: 'source' },   { role: '-',   description: '(unused)' }],           implemented: false },
    { mnemonic: 'ITOF', opcode: 0x37, format: 'E', description: 'rd = float(rs1)',                    category: 'convert', operands: [{ role: 'rd', description: 'destination' },  { role: 'rs1', description: 'source' },   { role: '-',   description: '(unused)' }],           implemented: false },
    { mnemonic: 'LOAD', opcode: 0x38, format: 'E', description: 'rd = mem[rs1 + rs2]',                category: 'memory',  operands: [{ role: 'rd', description: 'destination' },  { role: 'rs1', description: 'base addr' }, { role: 'rs2', description: 'offset' }],   implemented: true },
    { mnemonic: 'STORE',opcode: 0x39, format: 'E', description: 'mem[rs1 + rs2] = rd',               category: 'memory',  operands: [{ role: 'rd', description: 'value' },      { role: 'rs1', description: 'base addr' }, { role: 'rs2', description: 'offset' }],   implemented: true },
    { mnemonic: 'MOV',  opcode: 0x3A, format: 'E', description: 'rd = rs1',                           category: 'move',    operands: [{ role: 'rd', description: 'destination' },  { role: 'rs1', description: 'source' },   { role: '-',   description: '(unused)' }],           implemented: true },
    { mnemonic: 'SWP',  opcode: 0x3B, format: 'E', description: 'swap(rd, rs1)',                       category: 'move',    operands: [{ role: 'rd', description: 'register 1' },  { role: 'rs1', description: 'register 2' }, { role: '-', description: '(unused)' }],     implemented: true },
    { mnemonic: 'JZ',   opcode: 0x3C, format: 'E', description: 'if rd == 0: pc += rs1',              category: 'control', operands: [{ role: 'rd', description: 'condition reg' }, { role: 'rs1', description: 'offset reg' }, { role: '-', description: '(unused)' }],    implemented: true },
    { mnemonic: 'JNZ',  opcode: 0x3D, format: 'E', description: 'if rd != 0: pc += rs1',              category: 'control', operands: [{ role: 'rd', description: 'condition reg' }, { role: 'rs1', description: 'offset reg' }, { role: '-', description: '(unused)' }],    implemented: true },
    { mnemonic: 'JLT',  opcode: 0x3E, format: 'E', description: 'if rd < 0: pc += rs1',               category: 'control', operands: [{ role: 'rd', description: 'condition reg' }, { role: 'rs1', description: 'offset reg' }, { role: '-', description: '(unused)' }],    implemented: true },
    { mnemonic: 'JGT',  opcode: 0x3F, format: 'E', description: 'if rd > 0: pc += rs1',               category: 'control', operands: [{ role: 'rd', description: 'condition reg' }, { role: 'rs1', description: 'offset reg' }, { role: '-', description: '(unused)' }],    implemented: true },

    // Register + Imm16 (0x40–0x47) — Format F
    { mnemonic: 'MOVI16', opcode: 0x40, format: 'F', description: 'rd = imm16',                       category: 'move',       operands: [{ role: 'rd', description: 'destination' }, { role: 'imm16', description: '16-bit immediate' }], implemented: true },
    { mnemonic: 'ADDI16', opcode: 0x41, format: 'F', description: 'rd = rd + imm16',                  category: 'arithmetic', operands: [{ role: 'rd', description: 'destination' }, { role: 'imm16', description: '16-bit immediate' }], implemented: true },
    { mnemonic: 'SUBI16', opcode: 0x42, format: 'F', description: 'rd = rd - imm16',                  category: 'arithmetic', operands: [{ role: 'rd', description: 'destination' }, { role: 'imm16', description: '16-bit immediate' }], implemented: true },
    { mnemonic: 'JMP',   opcode: 0x43, format: 'F', description: 'pc += imm16 (relative jump)',       category: 'control',    operands: [{ role: 'rd', description: '(unused 0)' }, { role: 'imm16', description: 'relative offset' }], implemented: true },
    { mnemonic: 'JAL',   opcode: 0x44, format: 'F', description: 'rd = pc; pc += imm16',              category: 'control',    operands: [{ role: 'rd', description: 'link register' }, { role: 'imm16', description: 'relative offset' }], implemented: true },
    { mnemonic: 'CALL',  opcode: 0x45, format: 'F', description: 'push(pc); pc = rd + imm16',         category: 'control',    operands: [{ role: 'rd', description: 'target base' }, { role: 'imm16', description: 'offset' }],          implemented: false },
    { mnemonic: 'LOOP',  opcode: 0x46, format: 'F', description: 'rd--; if rd > 0: pc -= imm16',      category: 'control',    operands: [{ role: 'rd', description: 'counter' },      { role: 'imm16', description: 'loop body size' }],  implemented: false },
    { mnemonic: 'SELECT',opcode: 0x47, format: 'F', description: 'pc += imm16 * rd (computed jump)',  category: 'control',    operands: [{ role: 'rd', description: 'index' },       { role: 'imm16', description: 'stride' }],          implemented: false },

    // Register + Register + Imm16 (0x48–0x4F) — Format G
    { mnemonic: 'LOADOFF', opcode: 0x48, format: 'G', description: 'rd = mem[rs1 + imm16]',             category: 'memory', operands: [{ role: 'rd', description: 'destination' },  { role: 'rs1', description: 'base addr' }, { role: 'imm16', description: 'offset' }], implemented: true },
    { mnemonic: 'STOREOF', opcode: 0x49, format: 'G', description: 'mem[rs1 + imm16] = rd',            category: 'memory', operands: [{ role: 'rd', description: 'value' },      { role: 'rs1', description: 'base addr' }, { role: 'imm16', description: 'offset' }], implemented: true },
    { mnemonic: 'LOADI',  opcode: 0x4A, format: 'G', description: 'rd = mem[mem[rs1] + imm16]',        category: 'memory', operands: [{ role: 'rd', description: 'destination' },  { role: 'rs1', description: 'ptr ptr' },   { role: 'imm16', description: 'offset' }], implemented: false },
    { mnemonic: 'STOREI', opcode: 0x4B, format: 'G', description: 'mem[mem[rs1] + imm16] = rd',       category: 'memory', operands: [{ role: 'rd', description: 'value' },      { role: 'rs1', description: 'ptr ptr' },   { role: 'imm16', description: 'offset' }], implemented: false },
    { mnemonic: 'ENTER',  opcode: 0x4C, format: 'G', description: 'push regs; sp -= imm16; rd=old_sp',category: 'stack',  operands: [{ role: 'rd', description: 'saved sp' },   { role: 'rs1', description: 'reg mask' }, { role: 'imm16', description: 'frame size' }], implemented: false },
    { mnemonic: 'LEAVE',  opcode: 0x4D, format: 'G', description: 'sp += imm16; pop regs; rd=ret',    category: 'stack',  operands: [{ role: 'rd', description: 'return val' },  { role: 'rs1', description: 'reg mask' }, { role: 'imm16', description: 'frame size' }], implemented: false },
    { mnemonic: 'COPY',   opcode: 0x4E, format: 'G', description: 'memcpy(rd, rs1, imm16)',            category: 'memory', operands: [{ role: 'rd', description: 'dest addr' },   { role: 'rs1', description: 'src addr' },  { role: 'imm16', description: 'byte count' }], implemented: false },
    { mnemonic: 'FILL',   opcode: 0x4F, format: 'G', description: 'memset(rd, rs1, imm16)',            category: 'memory', operands: [{ role: 'rd', description: 'dest addr' },   { role: 'rs1', description: 'fill value' },{ role: 'imm16', description: 'byte count' }], implemented: false },

    // Agent-to-Agent (0x50–0x5F) — Format E
    { mnemonic: 'TELL',    opcode: 0x50, format: 'E', description: 'Send rs2 to agent rs1, tag rd',           category: 'a2a', operands: [{ role: 'rd', description: 'tag' },  { role: 'rs1', description: 'agent ID' }, { role: 'rs2', description: 'payload' }], implemented: false },
    { mnemonic: 'ASK',     opcode: 0x51, format: 'E', description: 'Request rs2 from agent rs1, resp->rd',     category: 'a2a', operands: [{ role: 'rd', description: 'result' },{ role: 'rs1', description: 'agent ID' }, { role: 'rs2', description: 'request' }], implemented: false },
    { mnemonic: 'DELEG',   opcode: 0x52, format: 'E', description: 'Delegate task rs2 to agent rs1',          category: 'a2a', operands: [{ role: 'rd', description: 'tag' },  { role: 'rs1', description: 'agent ID' }, { role: 'rs2', description: 'task' }],    implemented: false },
    { mnemonic: 'BCAST',   opcode: 0x53, format: 'E', description: 'Broadcast rs2 to fleet, tag rd',          category: 'a2a', operands: [{ role: 'rd', description: 'tag' },  { role: 'rs1', description: '(unused)' }, { role: 'rs2', description: 'payload' }], implemented: false },
    { mnemonic: 'ACCEPT',  opcode: 0x54, format: 'E', description: 'Accept delegated task, ctx->rd',          category: 'a2a', operands: [{ role: 'rd', description: 'context' },{ role: 'rs1', description: 'agent' },  { role: 'rs2', description: 'task ID' }], implemented: false },
    { mnemonic: 'DECLINE', opcode: 0x55, format: 'E', description: 'Decline task with reason rs2',            category: 'a2a', operands: [{ role: 'rd', description: 'tag' },  { role: 'rs1', description: 'agent' },  { role: 'rs2', description: 'reason' }],   implemented: false },
    { mnemonic: 'REPORT',  opcode: 0x56, format: 'E', description: 'Report task status rs2 to rd',            category: 'a2a', operands: [{ role: 'rd', description: 'target' },{ role: 'rs1', description: '(unused)' }, { role: 'rs2', description: 'status' }],  implemented: false },
    { mnemonic: 'MERGE',   opcode: 0x57, format: 'E', description: 'Merge results from rs1, rs2->rd',         category: 'a2a', operands: [{ role: 'rd', description: 'result' },{ role: 'rs1', description: 'result 1' }, { role: 'rs2', description: 'result 2' }], implemented: false },
    { mnemonic: 'FORK',    opcode: 0x58, format: 'E', description: 'Spawn child agent, state->rd',            category: 'a2a', operands: [{ role: 'rd', description: 'handle' },{ role: 'rs1', description: 'entry' },  { role: 'rs2', description: 'state' }],   implemented: false },
    { mnemonic: 'JOIN',    opcode: 0x59, format: 'E', description: 'Wait for child rs1, result->rd',          category: 'a2a', operands: [{ role: 'rd', description: 'result' },{ role: 'rs1', description: 'child' },  { role: 'rs2', description: '(unused)' }], implemented: false },
    { mnemonic: 'SIGNAL',  opcode: 0x5A, format: 'E', description: 'Emit named signal rs2 on channel rd',     category: 'a2a', operands: [{ role: 'rd', description: 'channel' },{ role: 'rs1', description: '(unused)' }, { role: 'rs2', description: 'signal' }],  implemented: false },
    { mnemonic: 'AWAIT',   opcode: 0x5B, format: 'E', description: 'Wait for signal rs2, data->rd',           category: 'a2a', operands: [{ role: 'rd', description: 'data' },  { role: 'rs1', description: '(unused)' }, { role: 'rs2', description: 'signal' }],  implemented: false },
    { mnemonic: 'TRUST',   opcode: 0x5C, format: 'E', description: 'Set trust level rs2 for agent rs1',       category: 'a2a', operands: [{ role: 'rd', description: '(unused)' },{ role: 'rs1', description: 'agent' },  { role: 'rs2', description: 'trust level' }], implemented: false },
    { mnemonic: 'DISCOV',  opcode: 0x5D, format: 'E', description: 'Discover fleet agents, list->rd',         category: 'a2a', operands: [{ role: 'rd', description: 'list' },  { role: 'rs1', description: '(unused)' }, { role: 'rs2', description: 'filter' }],   implemented: false },
    { mnemonic: 'STATUS',  opcode: 0x5E, format: 'E', description: 'Query agent rs1 status, result->rd',      category: 'a2a', operands: [{ role: 'rd', description: 'result' },{ role: 'rs1', description: 'agent' },  { role: 'rs2', description: '(unused)' }], implemented: false },
    { mnemonic: 'HEARTBT', opcode: 0x5F, format: 'E', description: 'Emit heartbeat, load->rd',                category: 'a2a', operands: [{ role: 'rd', description: 'load' },  { role: 'rs1', description: '(unused)' }, { role: 'rs2', description: '(unused)' }], implemented: false },

    // Confidence-Aware (0x60–0x6F) — Mixed formats
    { mnemonic: 'C_ADD',    opcode: 0x60, format: 'E', description: 'rd = rs1+rs2, crd=min(crs1,crs2)',  category: 'confidence', operands: [{ role: 'rd', description: 'dest' },  { role: 'rs1', description: 'src 1' }, { role: 'rs2', description: 'src 2' }], implemented: false },
    { mnemonic: 'C_SUB',    opcode: 0x61, format: 'E', description: 'rd = rs1-rs2, crd=min(crs1,crs2)',  category: 'confidence', operands: [{ role: 'rd', description: 'dest' },  { role: 'rs1', description: 'src 1' }, { role: 'rs2', description: 'src 2' }], implemented: false },
    { mnemonic: 'C_MUL',    opcode: 0x62, format: 'E', description: 'rd = rs1*rs2, crd=crs1*crs2',     category: 'confidence', operands: [{ role: 'rd', description: 'dest' },  { role: 'rs1', description: 'src 1' }, { role: 'rs2', description: 'src 2' }], implemented: false },
    { mnemonic: 'C_DIV',    opcode: 0x63, format: 'E', description: 'rd = rs1/rs2, crd=crs1*crs2*(1-e)',category: 'confidence', operands: [{ role: 'rd', description: 'dest' },  { role: 'rs1', description: 'src 1' }, { role: 'rs2', description: 'src 2' }], implemented: false },
    { mnemonic: 'C_FADD',   opcode: 0x64, format: 'E', description: 'Float add + confidence propagation', category: 'confidence', operands: [{ role: 'rd', description: 'dest' },  { role: 'rs1', description: 'src 1' }, { role: 'rs2', description: 'src 2' }], implemented: false },
    { mnemonic: 'C_FSUB',   opcode: 0x65, format: 'E', description: 'Float sub + confidence propagation', category: 'confidence', operands: [{ role: 'rd', description: 'dest' },  { role: 'rs1', description: 'src 1' }, { role: 'rs2', description: 'src 2' }], implemented: false },
    { mnemonic: 'C_FMUL',   opcode: 0x66, format: 'E', description: 'Float mul + confidence propagation', category: 'confidence', operands: [{ role: 'rd', description: 'dest' },  { role: 'rs1', description: 'src 1' }, { role: 'rs2', description: 'src 2' }], implemented: false },
    { mnemonic: 'C_FDIV',   opcode: 0x67, format: 'E', description: 'Float div + confidence propagation', category: 'confidence', operands: [{ role: 'rd', description: 'dest' },  { role: 'rs1', description: 'src 1' }, { role: 'rs2', description: 'src 2' }], implemented: false },
    { mnemonic: 'C_MERGE',  opcode: 0x68, format: 'E', description: 'Merge confidences: crd=weighted_avg', category: 'confidence', operands: [{ role: 'rd', description: 'dest' },  { role: 'rs1', description: 'src 1' }, { role: 'rs2', description: 'src 2' }], implemented: false },
    { mnemonic: 'C_THRESH', opcode: 0x69, format: 'D', description: 'Skip next if crd < imm8/255',       category: 'confidence', operands: [{ role: 'rd', description: 'reg' },   { role: 'imm8', description: 'threshold' }], implemented: false },
    { mnemonic: 'C_BOOST',  opcode: 0x6A, format: 'E', description: 'Boost crd by rs2 factor (max 1.0)', category: 'confidence', operands: [{ role: 'rd', description: 'dest' },  { role: 'rs1', description: 'src' },   { role: 'rs2', description: 'factor' }], implemented: false },
    { mnemonic: 'C_DECAY',  opcode: 0x6B, format: 'E', description: 'Decay crd by factor rs2 per cycle',  category: 'confidence', operands: [{ role: 'rd', description: 'dest' },  { role: 'rs1', description: 'src' },   { role: 'rs2', description: 'factor' }], implemented: false },
    { mnemonic: 'C_SOURCE', opcode: 0x6C, format: 'E', description: 'Set confidence source (sensor/model)',category: 'confidence', operands: [{ role: 'rd', description: 'dest' },  { role: 'rs1', description: 'src' },   { role: 'rs2', description: 'source' }], implemented: false },
    { mnemonic: 'C_CALIB',  opcode: 0x6D, format: 'E', description: 'Calibrate confidence vs ground truth',category: 'confidence', operands: [{ role: 'rd', description: 'dest' },  { role: 'rs1', description: 'pred' },  { role: 'rs2', description: 'truth' }], implemented: false },
    { mnemonic: 'C_EXPLY',  opcode: 0x6E, format: 'E', description: 'Apply confidence to control flow',   category: 'confidence', operands: [{ role: 'rd', description: 'dest' },  { role: 'rs1', description: 'src' },   { role: 'rs2', description: 'weight' }], implemented: false },
    { mnemonic: 'C_VOTE',   opcode: 0x6F, format: 'E', description: 'Weighted vote: crd=sum(crs*crs_i)/S', category: 'confidence', operands: [{ role: 'rd', description: 'result' },{ role: 'rs1', description: 'votes' }, { role: 'rs2', description: 'weights' }], implemented: false },

    // Viewpoint Operations (0x70–0x7F) — Format E
    { mnemonic: 'V_EVID',   opcode: 0x70, format: 'E', description: 'Evidentiality: source type rs2->rd',  category: 'viewpoint', operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'context' }, { role: 'rs2', description: 'type' }], implemented: false },
    { mnemonic: 'V_EPIST',  opcode: 0x71, format: 'E', description: 'Epistemic stance: certainty level',    category: 'viewpoint', operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'context' }, { role: 'rs2', description: 'level' }], implemented: false },
    { mnemonic: 'V_MIR',    opcode: 0x72, format: 'E', description: 'Mirative: unexpectedness marker',      category: 'viewpoint', operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'context' }, { role: 'rs2', description: 'value' }], implemented: false },
    { mnemonic: 'V_NEG',    opcode: 0x73, format: 'E', description: 'Negation scope: predicate vs proposition', category: 'viewpoint', operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'scope' }, { role: 'rs2', description: 'type' }], implemented: false },
    { mnemonic: 'V_TENSE',  opcode: 0x74, format: 'E', description: 'Temporal viewpoint alignment',        category: 'viewpoint', operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'context' }, { role: 'rs2', description: 'tense' }], implemented: false },
    { mnemonic: 'V_ASPEC',  opcode: 0x75, format: 'E', description: 'Aspectual viewpoint: complete/ongoing', category: 'viewpoint', operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'context' }, { role: 'rs2', description: 'aspect' }], implemented: false },
    { mnemonic: 'V_MODAL',  opcode: 0x76, format: 'E', description: 'Modal force: necessity/possibility',   category: 'viewpoint', operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'context' }, { role: 'rs2', description: 'force' }], implemented: false },
    { mnemonic: 'V_POLIT',  opcode: 0x77, format: 'E', description: 'Politeness register mapping',          category: 'viewpoint', operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'context' }, { role: 'rs2', description: 'level' }], implemented: false },
    { mnemonic: 'V_HONOR',  opcode: 0x78, format: 'E', description: 'Honorific level -> trust tier',        category: 'viewpoint', operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'context' }, { role: 'rs2', description: 'honor' }], implemented: false },
    { mnemonic: 'V_TOPIC',  opcode: 0x79, format: 'E', description: 'Topic-comment structure binding',       category: 'viewpoint', operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'topic' }, { role: 'rs2', description: 'comment' }], implemented: false },
    { mnemonic: 'V_FOCUS',  opcode: 0x7A, format: 'E', description: 'Information focus marking',            category: 'viewpoint', operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'context' }, { role: 'rs2', description: 'focus' }], implemented: false },
    { mnemonic: 'V_CASE',   opcode: 0x7B, format: 'E', description: 'Case-based scope assignment',          category: 'viewpoint', operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'context' }, { role: 'rs2', description: 'case' }], implemented: false },
    { mnemonic: 'V_AGREE',  opcode: 0x7C, format: 'E', description: 'Agreement (gender/number/person)',      category: 'viewpoint', operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'context' }, { role: 'rs2', description: 'features' }], implemented: false },
    { mnemonic: 'V_CLASS',  opcode: 0x7D, format: 'E', description: 'Classifier->type mapping',             category: 'viewpoint', operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'classifier' }, { role: 'rs2', description: 'type' }], implemented: false },
    { mnemonic: 'V_INFL',   opcode: 0x7E, format: 'E', description: 'Inflection->control flow mapping',     category: 'viewpoint', operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'infl' }, { role: 'rs2', description: 'mapping' }], implemented: false },
    { mnemonic: 'V_PRAGMA', opcode: 0x7F, format: 'E', description: 'Pragmatic context switch',             category: 'viewpoint', operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'context' }, { role: 'rs2', description: 'pragma' }], implemented: false },

    // Biology/Sensor (0x80–0x8F) — Format E
    { mnemonic: 'SENSE',  opcode: 0x80, format: 'E', description: 'Read sensor rs1, channel rs2->rd',   category: 'sensor', operands: [{ role: 'rd', description: 'data' },  { role: 'rs1', description: 'sensor ID' }, { role: 'rs2', description: 'channel' }], implemented: false },
    { mnemonic: 'ACTUATE',opcode: 0x81, format: 'E', description: 'Write rd to actuator rs1, ch rs2',   category: 'sensor', operands: [{ role: 'rd', description: 'value' }, { role: 'rs1', description: 'actuator ID' }, { role: 'rs2', description: 'channel' }], implemented: false },
    { mnemonic: 'SAMPLE', opcode: 0x82, format: 'E', description: 'Sample ADC channel rs1, avg rs2->rd', category: 'sensor', operands: [{ role: 'rd', description: 'data' },  { role: 'rs1', description: 'channel' }, { role: 'rs2', description: 'count' }], implemented: false },
    { mnemonic: 'ENERGY', opcode: 0x83, format: 'E', description: 'Energy budget: available->rd',        category: 'sensor', operands: [{ role: 'rd', description: 'available' }, { role: 'rs1', description: 'used' }, { role: 'rs2', description: '(unused)' }], implemented: false },
    { mnemonic: 'TEMP',   opcode: 0x84, format: 'E', description: 'Temperature sensor read->rd',        category: 'sensor', operands: [{ role: 'rd', description: 'temp' },  { role: 'rs1', description: '(unused)' }, { role: 'rs2', description: '(unused)' }], implemented: false },
    { mnemonic: 'GPS',    opcode: 0x85, format: 'E', description: 'GPS coordinates->rd, rs1',           category: 'sensor', operands: [{ role: 'rd', description: 'lat' },   { role: 'rs1', description: 'lon' }, { role: 'rs2', description: '(unused)' }], implemented: false },
    { mnemonic: 'ACCEL',  opcode: 0x86, format: 'E', description: 'Accelerometer 3-axis->rd, rs1, rs2', category: 'sensor', operands: [{ role: 'rd', description: 'x' },     { role: 'rs1', description: 'y' }, { role: 'rs2', description: 'z' }], implemented: false },
    { mnemonic: 'DEPTH',  opcode: 0x87, format: 'E', description: 'Depth/pressure sensor->rd',          category: 'sensor', operands: [{ role: 'rd', description: 'depth' }, { role: 'rs1', description: '(unused)' }, { role: 'rs2', description: '(unused)' }], implemented: false },
    { mnemonic: 'CAMCAP', opcode: 0x88, format: 'E', description: 'Capture camera frame rs1->buf rd',    category: 'sensor', operands: [{ role: 'rd', description: 'buffer' }, { role: 'rs1', description: 'camera' }, { role: 'rs2', description: '(unused)' }], implemented: false },
    { mnemonic: 'CAMDET', opcode: 0x89, format: 'E', description: 'Run detection, N results->rs1',       category: 'sensor', operands: [{ role: 'rd', description: 'buffer' }, { role: 'rs1', description: 'count' }, { role: 'rs2', description: '(unused)' }], implemented: false },
    { mnemonic: 'PWM',    opcode: 0x8A, format: 'E', description: 'PWM: pin rs1, duty rd, freq rs2',    category: 'sensor', operands: [{ role: 'rd', description: 'duty' },  { role: 'rs1', description: 'pin' }, { role: 'rs2', description: 'freq' }], implemented: false },
    { mnemonic: 'GPIO',   opcode: 0x8B, format: 'E', description: 'GPIO: read/write pin rs1',           category: 'sensor', operands: [{ role: 'rd', description: 'value' }, { role: 'rs1', description: 'pin' }, { role: 'rs2', description: 'direction' }], implemented: false },
    { mnemonic: 'I2C',    opcode: 0x8C, format: 'E', description: 'I2C: addr rs1, reg rs2, data rd',    category: 'sensor', operands: [{ role: 'rd', description: 'data' },  { role: 'rs1', description: 'addr' }, { role: 'rs2', description: 'reg' }], implemented: false },
    { mnemonic: 'SPI',    opcode: 0x8D, format: 'E', description: 'SPI: send rd, receive->rd, cs=rs1',  category: 'sensor', operands: [{ role: 'rd', description: 'data' },  { role: 'rs1', description: 'cs' }, { role: 'rs2', description: '(unused)' }], implemented: false },
    { mnemonic: 'UART',   opcode: 0x8E, format: 'E', description: 'UART: send rd bytes from buf rs1',   category: 'sensor', operands: [{ role: 'rd', description: 'length' },{ role: 'rs1', description: 'buffer' }, { role: 'rs2', description: '(unused)' }], implemented: false },
    { mnemonic: 'CANBUS', opcode: 0x8F, format: 'E', description: 'CAN bus: send rd with ID rs1',       category: 'sensor', operands: [{ role: 'rd', description: 'data' },  { role: 'rs1', description: 'ID' }, { role: 'rs2', description: '(unused)' }], implemented: false },

    // Extended Math/Crypto (0x90–0x9F) — Mixed formats
    { mnemonic: 'ABS',    opcode: 0x90, format: 'E', description: 'rd = |rs1|',                        category: 'math',   operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'src' }, { role: '-', description: '(unused)' }], implemented: true },
    { mnemonic: 'SIGN',   opcode: 0x91, format: 'E', description: 'rd = sign(rs1)',                     category: 'math',   operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'src' }, { role: '-', description: '(unused)' }], implemented: true },
    { mnemonic: 'SQRT',   opcode: 0x92, format: 'E', description: 'rd = sqrt(rs1)',                     category: 'math',   operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'src' }, { role: '-', description: '(unused)' }], implemented: false },
    { mnemonic: 'POW',    opcode: 0x93, format: 'E', description: 'rd = rs1 ^ rs2',                     category: 'math',   operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'base' }, { role: 'rs2', description: 'exp' }], implemented: false },
    { mnemonic: 'LOG2',   opcode: 0x94, format: 'E', description: 'rd = log2(rs1)',                     category: 'math',   operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'src' }, { role: '-', description: '(unused)' }], implemented: false },
    { mnemonic: 'CLZ',    opcode: 0x95, format: 'E', description: 'rd = count leading zeros(rs1)',       category: 'math',   operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'src' }, { role: '-', description: '(unused)' }], implemented: false },
    { mnemonic: 'CTZ',    opcode: 0x96, format: 'E', description: 'rd = count trailing zeros(rs1)',      category: 'math',   operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'src' }, { role: '-', description: '(unused)' }], implemented: false },
    { mnemonic: 'POPCNT', opcode: 0x97, format: 'E', description: 'rd = popcount(rs1)',                 category: 'math',   operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'src' }, { role: '-', description: '(unused)' }], implemented: false },
    { mnemonic: 'CRC32',  opcode: 0x98, format: 'E', description: 'rd = crc32(rs1, rs2)',               category: 'crypto', operands: [{ role: 'rd', description: 'hash' }, { role: 'rs1', description: 'data' }, { role: 'rs2', description: 'len' }], implemented: false },
    { mnemonic: 'SHA256', opcode: 0x99, format: 'E', description: 'SHA-256 block: msg rs1, len rs2->rd', category: 'crypto', operands: [{ role: 'rd', description: 'hash' }, { role: 'rs1', description: 'msg' }, { role: 'rs2', description: 'len' }], implemented: false },
    { mnemonic: 'RND',    opcode: 0x9A, format: 'E', description: 'rd = random in [rs1, rs2]',           category: 'math',   operands: [{ role: 'rd', description: 'result' }, { role: 'rs1', description: 'min' }, { role: 'rs2', description: 'max' }], implemented: true },
    { mnemonic: 'SEED',   opcode: 0x9B, format: 'E', description: 'Seed PRNG with rs1',                 category: 'math',   operands: [{ role: 'rd', description: '(unused)' }, { role: 'rs1', description: 'seed' }, { role: '-', description: '(unused)' }], implemented: false },
    { mnemonic: 'FMOD',   opcode: 0x9C, format: 'E', description: 'rd = fmod(rs1, rs2)',                category: 'float',  operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'x' }, { role: 'rs2', description: 'y' }], implemented: false },
    { mnemonic: 'FSQRT',  opcode: 0x9D, format: 'E', description: 'rd = fsqrt(rs1)',                    category: 'float',  operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'src' }, { role: '-', description: '(unused)' }], implemented: false },
    { mnemonic: 'FSIN',   opcode: 0x9E, format: 'E', description: 'rd = sin(rs1)',                      category: 'float',  operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'src' }, { role: '-', description: '(unused)' }], implemented: false },
    { mnemonic: 'FCOS',   opcode: 0x9F, format: 'E', description: 'rd = cos(rs1)',                      category: 'float',  operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'src' }, { role: '-', description: '(unused)' }], implemented: false },

    // String/Collection (0xA0–0xAF) — Mixed formats
    { mnemonic: 'LEN',    opcode: 0xA0, format: 'D', description: 'rd = length of collection imm8',      category: 'collection', operands: [{ role: 'rd', description: 'len' }, { role: 'imm8', description: 'collection ID' }], implemented: false },
    { mnemonic: 'CONCAT', opcode: 0xA1, format: 'E', description: 'rd = concat(rs1, rs2)',               category: 'collection', operands: [{ role: 'rd', description: 'result' }, { role: 'rs1', description: 'str1' }, { role: 'rs2', description: 'str2' }], implemented: false },
    { mnemonic: 'AT',     opcode: 0xA2, format: 'E', description: 'rd = rs1[rs2]',                      category: 'collection', operands: [{ role: 'rd', description: 'elem' }, { role: 'rs1', description: 'col' }, { role: 'rs2', description: 'index' }], implemented: false },
    { mnemonic: 'SETAT',  opcode: 0xA3, format: 'E', description: 'rs1[rs2] = rd',                      category: 'collection', operands: [{ role: 'rd', description: 'value' }, { role: 'rs1', description: 'col' }, { role: 'rs2', description: 'index' }], implemented: false },
    { mnemonic: 'SLICE',  opcode: 0xA4, format: 'G', description: 'rd = rs1[0:imm16]',                   category: 'collection', operands: [{ role: 'rd', description: 'result' }, { role: 'rs1', description: 'col' }, { role: 'imm16', description: 'end' }], implemented: false },
    { mnemonic: 'REDUCE', opcode: 0xA5, format: 'E', description: 'rd = fold(rs1, rs2)',                 category: 'collection', operands: [{ role: 'rd', description: 'result' }, { role: 'rs1', description: 'col' }, { role: 'rs2', description: 'fn' }], implemented: false },
    { mnemonic: 'MAP',    opcode: 0xA6, format: 'E', description: 'rd = map(rs1, fn rs2)',               category: 'collection', operands: [{ role: 'rd', description: 'result' }, { role: 'rs1', description: 'col' }, { role: 'rs2', description: 'fn' }], implemented: false },
    { mnemonic: 'FILTER', opcode: 0xA7, format: 'E', description: 'rd = filter(rs1, fn rs2)',            category: 'collection', operands: [{ role: 'rd', description: 'result' }, { role: 'rs1', description: 'col' }, { role: 'rs2', description: 'fn' }], implemented: false },
    { mnemonic: 'SORT',   opcode: 0xA8, format: 'E', description: 'rd = sort(rs1, cmp rs2)',             category: 'collection', operands: [{ role: 'rd', description: 'result' }, { role: 'rs1', description: 'col' }, { role: 'rs2', description: 'cmp' }], implemented: false },
    { mnemonic: 'FIND',   opcode: 0xA9, format: 'E', description: 'rd = index of rs2 in rs1 (-1=NF)',     category: 'collection', operands: [{ role: 'rd', description: 'index' }, { role: 'rs1', description: 'col' }, { role: 'rs2', description: 'elem' }], implemented: false },
    { mnemonic: 'HASH',   opcode: 0xAA, format: 'E', description: 'rd = hash(rs1, algorithm rs2)',       category: 'crypto',     operands: [{ role: 'rd', description: 'hash' }, { role: 'rs1', description: 'data' }, { role: 'rs2', description: 'algo' }], implemented: false },
    { mnemonic: 'HMAC',   opcode: 0xAB, format: 'E', description: 'rd = hmac(rs1, key rs2)',             category: 'crypto',     operands: [{ role: 'rd', description: 'mac' }, { role: 'rs1', description: 'data' }, { role: 'rs2', description: 'key' }], implemented: false },
    { mnemonic: 'VERIFY', opcode: 0xAC, format: 'E', description: 'rd = verify sig rs2 on data rs1',     category: 'crypto',     operands: [{ role: 'rd', description: 'valid' }, { role: 'rs1', description: 'data' }, { role: 'rs2', description: 'sig' }], implemented: false },
    { mnemonic: 'ENCRYPT',opcode: 0xAD, format: 'E', description: 'rd = encrypt rs1 with key rs2',       category: 'crypto',     operands: [{ role: 'rd', description: 'cipher' }, { role: 'rs1', description: 'data' }, { role: 'rs2', description: 'key' }], implemented: false },
    { mnemonic: 'DECRYPT',opcode: 0xAE, format: 'E', description: 'rd = decrypt rs1 with key rs2',       category: 'crypto',     operands: [{ role: 'rd', description: 'plain' }, { role: 'rs1', description: 'cipher' }, { role: 'rs2', description: 'key' }], implemented: false },
    { mnemonic: 'KEYGEN', opcode: 0xAF, format: 'E', description: 'rd = keypair, pub->rs1 priv->rs2',    category: 'crypto',     operands: [{ role: 'rd', description: 'handle' }, { role: 'rs1', description: 'pub' }, { role: 'rs2', description: 'priv' }], implemented: false },

    // Vector/SIMD (0xB0–0xBF) — Format E
    { mnemonic: 'VLOAD',   opcode: 0xB0, format: 'E', description: 'Load vector from mem[rs1], len rs2', category: 'vector', operands: [{ role: 'rd', description: 'vec' }, { role: 'rs1', description: 'addr' }, { role: 'rs2', description: 'len' }], implemented: false },
    { mnemonic: 'VSTORE',  opcode: 0xB1, format: 'E', description: 'Store vector rd to mem[rs1], len rs2',category: 'vector', operands: [{ role: 'rd', description: 'vec' }, { role: 'rs1', description: 'addr' }, { role: 'rs2', description: 'len' }], implemented: false },
    { mnemonic: 'VADD',    opcode: 0xB2, format: 'E', description: 'Vector add: rd[i] = rs1[i] + rs2[i]', category: 'vector', operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'a' }, { role: 'rs2', description: 'b' }], implemented: false },
    { mnemonic: 'VMUL',    opcode: 0xB3, format: 'E', description: 'Vector mul: rd[i] = rs1[i] * rs2[i]', category: 'vector', operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'a' }, { role: 'rs2', description: 'b' }], implemented: false },
    { mnemonic: 'VDOT',    opcode: 0xB4, format: 'E', description: 'Dot product: rd = sum(rs1[i]*rs2[i])',category: 'vector', operands: [{ role: 'rd', description: 'dot' }, { role: 'rs1', description: 'a' }, { role: 'rs2', description: 'b' }], implemented: false },
    { mnemonic: 'VNORM',   opcode: 0xB5, format: 'E', description: 'L2 norm: rd = sqrt(sum(rs1[i]^2))',  category: 'vector', operands: [{ role: 'rd', description: 'norm' }, { role: 'rs1', description: 'vec' }, { role: 'rs2', description: '(unused)' }], implemented: false },
    { mnemonic: 'VSCALE',  opcode: 0xB6, format: 'E', description: 'Scale: rd[i] = rs1[i] * rs2 (scalar)',category: 'vector', operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'vec' }, { role: 'rs2', description: 'scalar' }], implemented: false },
    { mnemonic: 'VMAXP',   opcode: 0xB7, format: 'E', description: 'Element-wise max: rd[i] = max(a,b)',  category: 'vector', operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'a' }, { role: 'rs2', description: 'b' }], implemented: false },
    { mnemonic: 'VMINP',   opcode: 0xB8, format: 'E', description: 'Element-wise min: rd[i] = min(a,b)',  category: 'vector', operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'a' }, { role: 'rs2', description: 'b' }], implemented: false },
    { mnemonic: 'VREDUCE', opcode: 0xB9, format: 'E', description: 'Reduce vector with op rs2',          category: 'vector', operands: [{ role: 'rd', description: 'result' }, { role: 'rs1', description: 'vec' }, { role: 'rs2', description: 'op' }], implemented: false },
    { mnemonic: 'VGATHER', opcode: 0xBA, format: 'E', description: 'Gather: rd[i] = mem[rs1[rs2[i]]]',   category: 'vector', operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'base' }, { role: 'rs2', description: 'indices' }], implemented: false },
    { mnemonic: 'VSCATTER',opcode: 0xBB, format: 'E', description: 'Scatter: mem[rs1[rs2[i]]] = rd[i]', category: 'vector', operands: [{ role: 'rd', description: 'src' }, { role: 'rs1', description: 'base' }, { role: 'rs2', description: 'indices' }], implemented: false },
    { mnemonic: 'VSHUF',  opcode: 0xBC, format: 'E', description: 'Shuffle lanes by index rs2',          category: 'vector', operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'vec' }, { role: 'rs2', description: 'idx' }], implemented: false },
    { mnemonic: 'VMERGE', opcode: 0xBD, format: 'E', description: 'Merge vectors by mask rs2',           category: 'vector', operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'vec' }, { role: 'rs2', description: 'mask' }], implemented: false },
    { mnemonic: 'VCONF',  opcode: 0xBE, format: 'E', description: 'Vector confidence propagation',       category: 'vector', operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'vec' }, { role: 'rs2', description: 'conf' }], implemented: false },
    { mnemonic: 'VSELECT',opcode: 0xBF, format: 'E', description: 'Conditional select by conf mask',     category: 'vector', operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'vec' }, { role: 'rs2', description: 'mask' }], implemented: false },

    // Tensor/Neural (0xC0–0xCF) — Format E
    { mnemonic: 'TMATMUL', opcode: 0xC0, format: 'E', description: 'Tensor matmul: rd = rs1 @ rs2',       category: 'tensor', operands: [{ role: 'rd', description: 'result' }, { role: 'rs1', description: 'A' }, { role: 'rs2', description: 'B' }], implemented: false },
    { mnemonic: 'TCONV',   opcode: 0xC1, format: 'E', description: '2D convolution: rd = conv(rs1, rs2)', category: 'tensor', operands: [{ role: 'rd', description: 'result' }, { role: 'rs1', description: 'input' }, { role: 'rs2', description: 'kernel' }], implemented: false },
    { mnemonic: 'TPOOL',   opcode: 0xC2, format: 'E', description: 'Max/avg pool: rd = pool(rs1, rs2)',    category: 'tensor', operands: [{ role: 'rd', description: 'result' }, { role: 'rs1', description: 'input' }, { role: 'rs2', description: 'config' }], implemented: false },
    { mnemonic: 'TRELU',   opcode: 0xC3, format: 'E', description: 'ReLU: rd = max(0, rs1)',              category: 'tensor', operands: [{ role: 'rd', description: 'result' }, { role: 'rs1', description: 'input' }, { role: '-', description: '(unused)' }], implemented: false },
    { mnemonic: 'TSIGM',   opcode: 0xC4, format: 'E', description: 'Sigmoid: rd = 1/(1+exp(-rs1))',      category: 'tensor', operands: [{ role: 'rd', description: 'result' }, { role: 'rs1', description: 'input' }, { role: '-', description: '(unused)' }], implemented: false },
    { mnemonic: 'TSOFT',   opcode: 0xC5, format: 'E', description: 'Softmax over dimension rs2',         category: 'tensor', operands: [{ role: 'rd', description: 'result' }, { role: 'rs1', description: 'input' }, { role: 'rs2', description: 'dim' }], implemented: false },
    { mnemonic: 'TLOSS',   opcode: 0xC6, format: 'E', description: 'Loss function: type rs2, pred rs1',   category: 'tensor', operands: [{ role: 'rd', description: 'loss' }, { role: 'rs1', description: 'pred' }, { role: 'rs2', description: 'type' }], implemented: false },
    { mnemonic: 'TGRAD',   opcode: 0xC7, format: 'E', description: 'Gradient: rd = dloss/drs1, lr=rs2',   category: 'tensor', operands: [{ role: 'rd', description: 'grad' }, { role: 'rs1', description: 'param' }, { role: 'rs2', description: 'lr' }], implemented: false },
    { mnemonic: 'TUPDATE', opcode: 0xC8, format: 'E', description: 'SGD update: rd -= rs2 * rs1',         category: 'tensor', operands: [{ role: 'rd', description: 'param' }, { role: 'rs1', description: 'grad' }, { role: 'rs2', description: 'lr' }], implemented: false },
    { mnemonic: 'TADAM',   opcode: 0xC9, format: 'E', description: 'Adam optimizer step',                category: 'tensor', operands: [{ role: 'rd', description: 'param' }, { role: 'rs1', description: 'grad' }, { role: 'rs2', description: 'config' }], implemented: false },
    { mnemonic: 'TEMBED',  opcode: 0xCA, format: 'E', description: 'Embedding lookup: token rs1',         category: 'tensor', operands: [{ role: 'rd', description: 'vec' }, { role: 'rs1', description: 'token' }, { role: 'rs2', description: 'table' }], implemented: false },
    { mnemonic: 'TATTN',   opcode: 0xCB, format: 'E', description: 'Self-attention: Q=rs1, K=V=rs2',      category: 'tensor', operands: [{ role: 'rd', description: 'result' }, { role: 'rs1', description: 'Q' }, { role: 'rs2', description: 'K,V' }], implemented: false },
    { mnemonic: 'TSAMPLE', opcode: 0xCC, format: 'E', description: 'Sample from distribution rs1',         category: 'tensor', operands: [{ role: 'rd', description: 'sample' }, { role: 'rs1', description: 'dist' }, { role: 'rs2', description: 'temp' }], implemented: false },
    { mnemonic: 'TTOKEN',  opcode: 0xCD, format: 'E', description: 'Tokenize: text rs1, vocab rs2->rd',   category: 'tensor', operands: [{ role: 'rd', description: 'tokens' }, { role: 'rs1', description: 'text' }, { role: 'rs2', description: 'vocab' }], implemented: false },
    { mnemonic: 'TDETOK',  opcode: 0xCE, format: 'E', description: 'Detokenize: tokens rs1, vocab rs2',   category: 'tensor', operands: [{ role: 'rd', description: 'text' }, { role: 'rs1', description: 'tokens' }, { role: 'rs2', description: 'vocab' }], implemented: false },
    { mnemonic: 'TQUANT',  opcode: 0xCF, format: 'E', description: 'Quantize: fp32 rs1 -> int8, scale rs2',category: 'tensor', operands: [{ role: 'rd', description: 'quant' }, { role: 'rs1', description: 'input' }, { role: 'rs2', description: 'scale' }], implemented: false },

    // Extended Memory/I-O (0xD0–0xDF) — Format G
    { mnemonic: 'DMA_CPY',  opcode: 0xD0, format: 'G', description: 'DMA: copy imm16 bytes rd<-rs1',       category: 'memory',  operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'src' }, { role: 'imm16', description: 'len' }], implemented: false },
    { mnemonic: 'DMA_SET',  opcode: 0xD1, format: 'G', description: 'DMA: fill imm16 bytes at rd with rs1',category: 'memory',  operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: 'value' }, { role: 'imm16', description: 'len' }], implemented: false },
    { mnemonic: 'MMIO_R',   opcode: 0xD2, format: 'G', description: 'MMIO read: rd = io[rs1 + imm16]',    category: 'memory',  operands: [{ role: 'rd', description: 'data' }, { role: 'rs1', description: 'addr' }, { role: 'imm16', description: 'offset' }], implemented: false },
    { mnemonic: 'MMIO_W',   opcode: 0xD3, format: 'G', description: 'MMIO write: io[rs1 + imm16] = rd',   category: 'memory',  operands: [{ role: 'rd', description: 'data' }, { role: 'rs1', description: 'addr' }, { role: 'imm16', description: 'offset' }], implemented: false },
    { mnemonic: 'ATOMIC',   opcode: 0xD4, format: 'G', description: 'Atomic RMW: swap(mem[rs1+imm16],rd)', category: 'memory',  operands: [{ role: 'rd', description: 'value' }, { role: 'rs1', description: 'addr' }, { role: 'imm16', description: 'offset' }], implemented: false },
    { mnemonic: 'CAS',      opcode: 0xD5, format: 'G', description: 'Compare-and-swap at rs1+imm16',       category: 'memory',  operands: [{ role: 'rd', description: 'new' }, { role: 'rs1', description: 'addr' }, { role: 'imm16', description: 'offset' }], implemented: false },
    { mnemonic: 'FENCE',    opcode: 0xD6, format: 'G', description: 'Memory fence: type imm16 (acq/rel)',  category: 'memory',  operands: [{ role: 'rd', description: '(unused)' }, { role: 'rs1', description: '(unused)' }, { role: 'imm16', description: 'type' }], implemented: false },
    { mnemonic: 'MALLOC',   opcode: 0xD7, format: 'G', description: 'Allocate imm16 bytes, handle->rd',    category: 'memory',  operands: [{ role: 'rd', description: 'handle' }, { role: 'rs1', description: '(unused)' }, { role: 'imm16', description: 'size' }], implemented: false },
    { mnemonic: 'FREE',     opcode: 0xD8, format: 'G', description: 'Free allocation at rd',               category: 'memory',  operands: [{ role: 'rd', description: 'handle' }, { role: 'rs1', description: '(unused)' }, { role: 'imm16', description: '(unused)' }], implemented: false },
    { mnemonic: 'MPROT',    opcode: 0xD9, format: 'G', description: 'Memory protect: rd=start, rs1=len',   category: 'memory',  operands: [{ role: 'rd', description: 'start' }, { role: 'rs1', description: 'len' }, { role: 'imm16', description: 'flags' }], implemented: false },
    { mnemonic: 'MCACHE',   opcode: 0xDA, format: 'G', description: 'Cache management: op imm16, addr rd',  category: 'memory',  operands: [{ role: 'rd', description: 'addr' }, { role: 'rs1', description: 'len' }, { role: 'imm16', description: 'op' }], implemented: false },
    { mnemonic: 'GPU_LD',   opcode: 0xDB, format: 'G', description: 'GPU: load to device mem, offset imm16',category: 'memory',  operands: [{ role: 'rd', description: 'src' }, { role: 'rs1', description: '(unused)' }, { role: 'imm16', description: 'offset' }], implemented: false },
    { mnemonic: 'GPU_ST',   opcode: 0xDC, format: 'G', description: 'GPU: store from device mem',           category: 'memory',  operands: [{ role: 'rd', description: 'dest' }, { role: 'rs1', description: '(unused)' }, { role: 'imm16', description: 'offset' }], implemented: false },
    { mnemonic: 'GPU_EX',   opcode: 0xDD, format: 'G', description: 'GPU: execute kernel rd',              category: 'compute', operands: [{ role: 'rd', description: 'kernel' }, { role: 'rs1', description: 'grid' }, { role: 'imm16', description: 'block' }], implemented: false },
    { mnemonic: 'GPU_SYNC', opcode: 0xDE, format: 'G', description: 'GPU: synchronize device',             category: 'compute', operands: [{ role: 'rd', description: '(unused)' }, { role: 'rs1', description: '(unused)' }, { role: 'imm16', description: '(unused)' }], implemented: false },

    // Long Jumps/Calls (0xE0–0xEF) — Format F
    { mnemonic: 'JMPL',     opcode: 0xE0, format: 'F', description: 'Long relative jump: pc += imm16',          category: 'control', operands: [{ role: 'rd', description: '(unused 0)' }, { role: 'imm16', description: 'offset' }], implemented: false },
    { mnemonic: 'JALL',     opcode: 0xE1, format: 'F', description: 'Long jump-and-link: rd = pc; pc += imm16', category: 'control', operands: [{ role: 'rd', description: 'link' }, { role: 'imm16', description: 'offset' }], implemented: false },
    { mnemonic: 'CALLL',    opcode: 0xE2, format: 'F', description: 'Long call: push(pc); pc = rd + imm16',     category: 'control', operands: [{ role: 'rd', description: 'target' }, { role: 'imm16', description: 'offset' }], implemented: false },
    { mnemonic: 'TAIL',     opcode: 0xE3, format: 'F', description: 'Tail call: pop frame; pc = rd + imm16',    category: 'control', operands: [{ role: 'rd', description: 'target' }, { role: 'imm16', description: 'offset' }], implemented: false },
    { mnemonic: 'SWITCH',   opcode: 0xE4, format: 'F', description: 'Context switch: save state, jump imm16',   category: 'control', operands: [{ role: 'rd', description: 'state' }, { role: 'imm16', description: 'target' }], implemented: false },
    { mnemonic: 'COYIELD',  opcode: 0xE5, format: 'F', description: 'Coroutine yield: save, jump to imm16',    category: 'control', operands: [{ role: 'rd', description: 'state' }, { role: 'imm16', description: 'target' }], implemented: false },
    { mnemonic: 'CORESUM',  opcode: 0xE6, format: 'F', description: 'Coroutine resume: restore, jump to rd',   category: 'control', operands: [{ role: 'rd', description: 'state' }, { role: 'imm16', description: '(unused)' }], implemented: false },
    { mnemonic: 'FAULT',    opcode: 0xE7, format: 'F', description: 'Raise fault code imm16, context rd',       category: 'system', operands: [{ role: 'rd', description: 'context' }, { role: 'imm16', description: 'code' }], implemented: false },
    { mnemonic: 'HANDLER',  opcode: 0xE8, format: 'F', description: 'Install fault handler at pc + imm16',     category: 'system', operands: [{ role: 'rd', description: '(unused)' }, { role: 'imm16', description: 'handler' }], implemented: false },
    { mnemonic: 'TRACE',    opcode: 0xE9, format: 'F', description: 'Trace: log rd, tag imm16',                category: 'debug', operands: [{ role: 'rd', description: 'value' }, { role: 'imm16', description: 'tag' }], implemented: false },
    { mnemonic: 'PROF_ON',  opcode: 0xEA, format: 'F', description: 'Start profiling region imm16',           category: 'debug', operands: [{ role: 'rd', description: '(unused)' }, { role: 'imm16', description: 'region' }], implemented: false },
    { mnemonic: 'PROF_OFF', opcode: 0xEB, format: 'F', description: 'End profiling region imm16',             category: 'debug', operands: [{ role: 'rd', description: '(unused)' }, { role: 'imm16', description: 'region' }], implemented: false },
    { mnemonic: 'WATCH',    opcode: 0xEC, format: 'F', description: 'Watchpoint: break on write to rd+imm16',  category: 'debug', operands: [{ role: 'rd', description: 'addr' }, { role: 'imm16', description: 'size' }], implemented: false },

    // Extended System/Debug (0xF0–0xFF) — Format A
    { mnemonic: 'HALT_ERR', opcode: 0xF0, format: 'A', description: 'Halt with error (check flags)',          category: 'system', operands: [], implemented: true },
    { mnemonic: 'REBOOT',   opcode: 0xF1, format: 'A', description: 'Warm reboot (preserve memory)',           category: 'system', operands: [], implemented: false },
    { mnemonic: 'DUMP',     opcode: 0xF2, format: 'A', description: 'Dump register file to debug output',      category: 'debug', operands: [], implemented: true },
    { mnemonic: 'ASSERT',   opcode: 0xF3, format: 'A', description: 'Assert flags, halt if violation',         category: 'debug', operands: [], implemented: true },
    { mnemonic: 'ID',       opcode: 0xF4, format: 'A', description: 'Return agent ID to r0',                  category: 'system', operands: [], implemented: false },
    { mnemonic: 'VER',      opcode: 0xF5, format: 'A', description: 'Return ISA version to r0',                category: 'system', operands: [], implemented: true },
    { mnemonic: 'CLK',      opcode: 0xF6, format: 'A', description: 'Return clock cycle count to r0',         category: 'system', operands: [], implemented: false },
    { mnemonic: 'PCLK',     opcode: 0xF7, format: 'A', description: 'Return performance counter to r0',       category: 'system', operands: [], implemented: false },
    { mnemonic: 'WDOG',     opcode: 0xF8, format: 'A', description: 'Kick watchdog timer',                    category: 'system', operands: [], implemented: false },
    { mnemonic: 'SLEEP',    opcode: 0xF9, format: 'A', description: 'Enter low-power sleep (wake on int)',     category: 'system', operands: [], implemented: false },
    { mnemonic: 'ILLEGAL',  opcode: 0xFF, format: 'A', description: 'Illegal instruction trap',               category: 'system', operands: [], implemented: true },
];

// ─── Database ────────────────────────────────────────────────────────────────

/** Map of mnemonic (uppercase) -> OpcodeInfo */
export const OPCODE_DATABASE = new Map<string, OpcodeInfo>();

for (const op of RAW_OPCODES) {
    OPCODE_DATABASE.set(op.mnemonic, op);
}

/** Lookup an opcode by mnemonic (case-insensitive). */
export function lookupOpcode(mnemonic: string): OpcodeInfo | undefined {
    return OPCODE_DATABASE.get(mnemonic.toUpperCase());
}

/** Get all opcodes in a given category. */
export function getOpcodesByCategory(category: string): OpcodeInfo[] {
    return RAW_OPCODES.filter(op => op.category === category);
}

/** Get all unique opcode categories. */
export function getCategories(): string[] {
    const cats = new Set(RAW_OPCODES.map(op => op.category));
    return [...cats].sort();
}

/** Get format description for encoding size. */
export function getFormatDescription(fmt: FormatType): string {
    switch (fmt) {
        case 'A': return '1 byte — [opcode]';
        case 'B': return '2 bytes — [opcode][reg:u8]';
        case 'C': return '2 bytes — [opcode][imm8:u8]';
        case 'D': return '3 bytes — [opcode][reg:u8][imm8:i8]';
        case 'E': return '4 bytes — [opcode][rd:u8][rs1:u8][rs2:u8]';
        case 'F': return '4 bytes — [opcode][reg:u8][imm16:i16]';
        case 'G': return '5 bytes — [opcode][rd:u8][rs1:u8][imm16:i16]';
    }
}

/** Generate a markdown hover string for an opcode. */
export function formatOpcodeMarkdown(info: OpcodeInfo): string {
    const opStr = info.operands
        .filter(o => o.role !== '-')
        .map(o => o.description)
        .join(', ');
    const operandStr = info.operands
        .filter(o => o.role !== '-')
        .map(o => o.role)
        .join(', ');

    return [
        `**${info.mnemonic}** (0x${info.opcode.toString(16).toUpperCase().padStart(2, '0')})`,
        ``,
        `${info.description}`,
        ``,
        `Format **${info.format}** — ${getFormatDescription(info.format)}`,
        ``,
        `Operands: \`${info.operands.length === 0 ? '(none)' : operandStr}\``,
        `Category: \`${info.category}\``,
        info.implemented ? '' : `*Not yet verified in conformance tests*`,
    ].filter(Boolean).join('\n');
}

// ─── Completion Items ────────────────────────────────────────────────────────

/** Register names for completion. */
export const GP_REGISTERS = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7',
    'R8', 'R9', 'R10', 'R11', 'R12', 'R13', 'R14', 'R15'];
export const FP_REGISTERS = ['F0', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7',
    'F8', 'F9', 'F10', 'F11', 'F12', 'F13', 'F14', 'F15'];
export const VEC_REGISTERS = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7',
    'V8', 'V9', 'V10', 'V11', 'V12', 'V13', 'V14', 'V15'];
export const SPECIAL_REGISTERS = ['SP', 'FP', 'LR', 'PC', 'FLAGS'];
export const ALL_REGISTERS = [...GP_REGISTERS, ...FP_REGISTERS, ...VEC_REGISTERS, ...SPECIAL_REGISTERS];

/** Directives for completion. */
export const DIRECTIVES = [
    '.text', '.data', '.bss', '.global', '.extern', '.ascii', '.asciz', '.byte',
    '.word', '.half', '.space', '.align', '.section', '.type', '.size', '.equ',
    '.macro', '.endm', '.include', '.set',
];

/** Generate snippet insert text for an opcode's operands. */
function buildOpcodeSnippet(mnemonic: string, operands: OperandInfo[]): string {
    const activeOps = operands.filter(o => o.role !== '-');
    if (activeOps.length === 0) return mnemonic;

    const roleToPlaceholder = new Map<string, number>();
    let nextPlaceholder = 1;

    const parts = activeOps.map(o => {
        if (o.role === 'imm8' || o.role === 'imm16') {
            return `\${${nextPlaceholder++}:0}`;
        }
        // Register operand — reuse same placeholder if same role appears again
        if (!roleToPlaceholder.has(o.role)) {
            roleToPlaceholder.set(o.role, nextPlaceholder++);
        }
        return `\${${roleToPlaceholder.get(o.role)}:${o.role}}`;
    });

    return `${mnemonic} ${parts.join(', ')}$0`;
}

/** Generate LSP CompletionItems for all opcodes. */
export function getOpcodeCompletionItems(): CompletionItem[] {
    return RAW_OPCODES.map(op => {
        const activeOps = op.operands.filter(o => o.role !== '-');
        const operandStr = activeOps.map(o => o.role).join(', ');

        return {
            label: op.mnemonic,
            kind: CompletionItemKind.Function,
            detail: `0x${op.opcode.toString(16).toUpperCase().padStart(2, '0')} — Format ${op.format} — ${op.category}`,
            documentation: op.description,
            insertText: op.operands.length === 0
                ? op.mnemonic
                : `${op.mnemonic} ${op.operands.filter(o => o.role !== '-').map(o => o.role === 'imm8' ? '${1:0}' : o.role === 'imm16' ? '${1:0}' : `$\{${o.role}\``).join(', ')}$0`,
            insertTextFormat: InsertTextFormat.Snippet,
            sortText: op.mnemonic,
        } as CompletionItem;
    });
}

/** Generate LSP CompletionItems for all registers. */
export function getRegisterCompletionItems(): CompletionItem[] {
    const items: CompletionItem[] = [];

    for (const reg of GP_REGISTERS) {
        items.push({
            label: reg,
            kind: CompletionItemKind.Variable,
            detail: `General-purpose register ${reg}`,
            documentation: reg === 'R11' ? 'SP — Stack pointer' :
                          reg === 'R14' ? 'FP — Frame pointer' :
                          reg === 'R15' ? 'LR — Link register (return address)' :
                          `Integer register ${parseInt(reg.slice(1))}`,
            sortText: `0${reg}`,
        });
    }
    for (const reg of FP_REGISTERS) {
        items.push({
            label: reg,
            kind: CompletionItemKind.Variable,
            detail: `Floating-point register ${reg}`,
            sortText: `1${reg}`,
        });
    }
    for (const reg of VEC_REGISTERS) {
        items.push({
            label: reg,
            kind: CompletionItemKind.Variable,
            detail: `SIMD vector register ${reg}`,
            sortText: `2${reg}`,
        });
    }
    for (const reg of SPECIAL_REGISTERS) {
        items.push({
            label: reg,
            kind: CompletionItemKind.Constant,
            detail: `Special register: ${reg}`,
            documentation: reg === 'SP' ? 'Stack pointer (alias R11)' :
                          reg === 'FP' ? 'Frame pointer (alias R14)' :
                          reg === 'LR' ? 'Link register / return address (alias R15)' :
                          reg === 'PC' ? 'Program counter (read-only in most contexts)' :
                          'Status flags (Z, S, C, V)',
            sortText: `3${reg}`,
        });
    }
    return items;
}

/** Generate LSP CompletionItems for all directives. */
export function getDirectiveCompletionItems(): CompletionItem[] {
    return DIRECTIVES.map(d => ({
        label: d,
        kind: CompletionItemKind.Keyword,
        detail: 'FLUX assembler directive',
        sortText: `4${d}`,
    }));
}

// ─── Directive Documentation ────────────────────────────────────────────────

interface DirectiveInfo {
    name: string;
    syntax: string;
    description: string;
    example?: string;
}

const DIRECTIVE_DOCS: DirectiveInfo[] = [
    { name: '.text', syntax: '.text', description: 'Switch to the code (text) section. All subsequent instructions go here.' },
    { name: '.data', syntax: '.data', description: 'Switch to the initialized data section. Used for .word, .ascii, etc.' },
    { name: '.bss', syntax: '.bss', description: 'Switch to uninitialized data section. Used for .space reservations.' },
    { name: '.global', syntax: '.global <symbol>', description: 'Export a label symbol so it can be referenced from other files.', example: '.global main' },
    { name: '.extern', syntax: '.extern <symbol>', description: 'Declare a symbol that is defined in another file.', example: '.extern printf' },
    { name: '.ascii', syntax: '.ascii "string"', description: 'Emit a null-terminated ASCII string literal into the data section.' },
    { name: '.asciz', syntax: '.asciz "string"', description: 'Emit a NUL-terminated string (same as .ascii, adds NUL byte).' },
    { name: '.byte', syntax: '.byte <value>[, ...]', description: 'Emit one or more 8-bit byte values.', example: '.byte 0x41, 0x42, 0x43' },
    { name: '.word', syntax: '.word <value>[, ...]', description: 'Emit one or more 32-bit word values.', example: '.word 0xDEADBEEF' },
    { name: '.half', syntax: '.half <value>[, ...]', description: 'Emit one or more 16-bit halfword values.' },
    { name: '.space', syntax: '.space <bytes>', description: 'Reserve <bytes> bytes of zero-initialized storage.', example: '.space 1024' },
    { name: '.align', syntax: '.align <n>', description: 'Align the next data/instruction to a 2^n byte boundary.', example: '.align 4' },
    { name: '.section', syntax: '.section <name>', description: 'Switch to a named section. Common: .text, .data, .bss.' },
    { name: '.type', syntax: '.type <symbol>, @<type>', description: 'Set the type of a symbol (e.g., @function, @object).', example: '.type main, @function' },
    { name: '.size', syntax: '.size <symbol>, . - <symbol>', description: 'Set the size of a symbol (used with .type).', example: '.size main, . - main' },
    { name: '.equ', syntax: '.equ <name>, <value>', description: 'Define a named constant (assembly-time substitution).', example: '.equ BUF_SIZE, 256' },
    { name: '.macro', syntax: '.macro <name> <params...>', description: 'Begin a macro definition. Ends with .endm.' },
    { name: '.endm', syntax: '.endm', description: 'End a macro definition started with .macro.' },
    { name: '.include', syntax: '.include "<file>"', description: 'Include another assembly file at this point.', example: '.include "constants.flux"' },
    { name: '.set', syntax: '.set <name>, <value>', description: 'Set a symbol to a value (like .equ but reassignable).' },
];

/**
 * Look up documentation for an assembler directive.
 */
export function lookupDirective(name: string): DirectiveInfo | undefined {
    return DIRECTIVE_DOCS.find(d => d.name === name);
}

/**
 * Format directive information as Markdown for hover.
 */
export function formatDirectiveMarkdown(info: DirectiveInfo): string {
    let md = `**${info.name}** — ${info.syntax}\n\n${info.description}`;
    if (info.example) {
        md += `\n\n\`\`\`\n${info.example}\n\`\`\``;
    }
    return md;
}
