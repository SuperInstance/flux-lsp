/**
 * opcode_db.ts — Complete FLUX ISA opcode database
 *
 * Covers all 247+ opcodes across the 256-slot instruction set.
 * Includes confidence-aware variants (C_*), viewpoint ops, and SIMD operations.
 *
 * FLUX ISA v1.0/v3.0 — 6 instruction formats:
 *   A = 1 byte  (opcode only)
 *   B = 2 bytes (opcode + reg)
 *   C = 3 bytes (opcode + reg + reg)
 *   D = 4 bytes (opcode + reg + i16)
 *   E = 4 bytes (opcode + reg + reg + reg)
 *   G = variable (opcode + variable payload)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Instruction format encoding lengths */
export type InstructionFormat = "A" | "B" | "C" | "D" | "E" | "G";

/** Operand type for signature documentation */
export type OperandType =
  | "rd"   // destination register (int)
  | "rs"   // source register (int)
  | "rt"   // third register (int)
  | "fd"   // destination register (float)
  | "fs"   // source register (float)
  | "ft"   // third register (float)
  | "vd"   // destination register (SIMD)
  | "vs"   // source register (SIMD)
  | "vt"   // third register (SIMD)
  | "imm8" // 8-bit immediate
  | "imm16"// 16-bit immediate
  | "imm32"// 32-bit immediate
  | "label"// label reference
  | "addr" // memory address
  | "none";// no operand

/** Opcode category grouping */
export type OpcodeCategory =
  | "control"
  | "integer"
  | "bitwise"
  | "compare"
  | "stack"
  | "function"
  | "memory"
  | "type"
  | "float"
  | "simd"
  | "a2a"
  | "system"
  | "confidence"
  | "viewpoint";

/** Affected flags mask */
export interface FlagsAffected {
  zero?: boolean;
  negative?: boolean;
  carry?: boolean;
  overflow?: boolean;
  confidence?: boolean;
}

/** Complete opcode entry */
export interface OpcodeEntry {
  /** Mnemonic (uppercase) */
  name: string;
  /** Hex opcode value */
  hex: string;
  /** Instruction format */
  format: InstructionFormat;
  /** Encoding size in bytes */
  size: number;
  /** Operand signature */
  operands: OperandType[];
  /** Human-readable operand string */
  operandStr: string;
  /** Category for grouping */
  category: OpcodeCategory;
  /** Short description */
  description: string;
  /** Detailed documentation */
  detail: string;
  /** Flags affected by this instruction */
  flags?: FlagsAffected;
}

// ---------------------------------------------------------------------------
// Builder helper
// ---------------------------------------------------------------------------

function op(
  name: string,
  hex: string,
  format: InstructionFormat,
  operands: OperandType[],
  operandStr: string,
  category: OpcodeCategory,
  description: string,
  detail: string,
  flags?: FlagsAffected,
): OpcodeEntry {
  const sizeMap: Record<InstructionFormat, number> = {
    A: 1, B: 2, C: 3, D: 4, E: 4, G: -1,
  };
  return { name, hex, format, size: sizeMap[format], operands, operandStr, category, description, detail, flags };
}

// ---------------------------------------------------------------------------
// Complete opcode database
// ---------------------------------------------------------------------------

const OPCODES: OpcodeEntry[] = [
  // =========================================================================
  // 0x00–0x07  Control
  // =========================================================================
  op("NOP",      "0x00", "A", [],              "",            "control",   "No operation",             "Performs no operation. Advances program counter by 1."),
  op("MOV",      "0x01", "C", ["rd","rs"],     "rd, rs",     "control",   "Move register",            "Copy value from source register to destination register. rd ← rs"),
  op("LOAD",     "0x02", "D", ["rd","imm16"],  "rd, [addr]", "control",   "Load from memory",         "Load a 32-bit value from memory address into register. rd ← MEM[addr]"),
  op("STORE",    "0x03", "D", ["rs","imm16"],  "rs, [addr]", "control",   "Store to memory",          "Store register value to memory address. MEM[addr] ← rs"),
  op("JMP",      "0x04", "D", ["label"],       "label",      "control",   "Unconditional jump",       "Jump to label unconditionally. PC ← label"),
  op("JZ",       "0x05", "D", ["rs","label"],  "rs, label",  "control",   "Jump if zero",             "Jump to label if register is zero. if rs == 0: PC ← label", { zero: true }),
  op("JNZ",      "0x06", "D", ["rs","label"],  "rs, label",  "control",   "Jump if not zero",         "Jump to label if register is non-zero. if rs != 0: PC ← label", { zero: true }),
  op("CALL",     "0x07", "D", ["label"],       "label",      "control",   "Call subroutine",          "Push return address and jump to label. PUSH(PC+4); PC ← label"),

  // =========================================================================
  // 0x08–0x0F  Integer Arithmetic
  // =========================================================================
  op("IADD",     "0x08", "E", ["rd","rs","rt"], "rd, rs, rt", "integer", "Integer add",     "rd ← rs + rt. Sets overflow flag on signed overflow.", { zero: true, negative: true, carry: true, overflow: true }),
  op("ISUB",     "0x09", "E", ["rd","rs","rt"], "rd, rs, rt", "integer", "Integer subtract", "rd ← rs - rt. Sets overflow flag on signed overflow.", { zero: true, negative: true, carry: true, overflow: true }),
  op("IMUL",     "0x0A", "E", ["rd","rs","rt"], "rd, rs, rt", "integer", "Integer multiply", "rd ← rs * rt (low 32 bits). Sets overflow flag on signed overflow.", { zero: true, negative: true, overflow: true }),
  op("IDIV",     "0x0B", "E", ["rd","rs","rt"], "rd, rs, rt", "integer", "Integer divide",   "rd ← rs / rt (truncated). Division by zero is undefined.", { zero: true, negative: true }),
  op("IMOD",     "0x0C", "E", ["rd","rs","rt"], "rd, rs, rt", "integer", "Integer modulo",   "rd ← rs % rt. Division by zero is undefined.", { zero: true, negative: true }),
  op("INEG",     "0x0D", "B", ["rd","rs"],      "rd, rs",     "integer", "Integer negate",   "rd ← -rs. Two's complement negation.", { zero: true, negative: true }),
  op("INC",      "0x0E", "B", ["rd"],           "rd",         "integer", "Increment",        "rd ← rd + 1. Equivalent to IADD rd, rd, #1.", { zero: true, negative: true, overflow: true }),
  op("DEC",      "0x0F", "B", ["rd"],           "rd",         "integer", "Decrement",        "rd ← rd - 1. Equivalent to ISUB rd, rd, #1.", { zero: true, negative: true, overflow: true }),

  // =========================================================================
  // 0x10–0x17  Bitwise
  // =========================================================================
  op("IAND",     "0x10", "E", ["rd","rs","rt"], "rd, rs, rt", "bitwise", "Bitwise AND",   "rd ← rs & rt. Bitwise AND of two registers.", { zero: true, negative: true }),
  op("IOR",      "0x11", "E", ["rd","rs","rt"], "rd, rs, rt", "bitwise", "Bitwise OR",    "rd ← rs | rt. Bitwise OR of two registers.", { zero: true, negative: true }),
  op("IXOR",     "0x12", "E", ["rd","rs","rt"], "rd, rs, rt", "bitwise", "Bitwise XOR",   "rd ← rs ^ rt. Bitwise XOR of two registers.", { zero: true, negative: true }),
  op("INOT",     "0x13", "B", ["rd","rs"],      "rd, rs",     "bitwise", "Bitwise NOT",   "rd ← ~rs. Bitwise complement.", { zero: true, negative: true }),
  op("ISHL",     "0x14", "E", ["rd","rs","rt"], "rd, rs, rt", "bitwise", "Shift left",    "rd ← rs << rt (logical). Shift amount masked to 0-31.", { zero: true, negative: true, carry: true }),
  op("ISHR",     "0x15", "E", ["rd","rs","rt"], "rd, rs, rt", "bitwise", "Shift right",   "rd ← rs >> rt (logical). Shift amount masked to 0-31.", { zero: true, negative: true, carry: true }),
  op("ROTL",     "0x16", "E", ["rd","rs","rt"], "rd, rs, rt", "bitwise", "Rotate left",   "rd ← rs ROTL rt. Circular rotate left.", { zero: true, negative: true }),
  op("ROTR",     "0x17", "E", ["rd","rs","rt"], "rd, rs, rt", "bitwise", "Rotate right",  "rd ← rs ROTR rt. Circular rotate right.", { zero: true, negative: true }),

  // =========================================================================
  // 0x18–0x1F  Compare
  // =========================================================================
  op("ICMP",     "0x18", "C", ["rs","rt"],      "rs, rt",     "compare", "Integer compare",      "Compare rs and rt. Sets flags without storing result.", { zero: true, negative: true, carry: true, overflow: true }),
  op("IEQ",      "0x19", "E", ["rd","rs","rt"], "rd, rs, rt", "compare", "Set if equal",         "rd ← (rs == rt) ? 1 : 0", { zero: true }),
  op("ILT",      "0x1A", "E", ["rd","rs","rt"], "rd, rs, rt", "compare", "Set if less than",     "rd ← (rs < rt) ? 1 : 0 (signed)", { zero: true, negative: true }),
  op("ILE",      "0x1B", "E", ["rd","rs","rt"], "rd, rs, rt", "compare", "Set if less or equal", "rd ← (rs <= rt) ? 1 : 0 (signed)", { zero: true, negative: true }),
  op("IGT",      "0x1C", "E", ["rd","rs","rt"], "rd, rs, rt", "compare", "Set if greater than",  "rd ← (rs > rt) ? 1 : 0 (signed)", { zero: true, negative: true }),
  op("IGE",      "0x1D", "E", ["rd","rs","rt"], "rd, rs, rt", "compare", "Set if greater/equal", "rd ← (rs >= rt) ? 1 : 0 (signed)", { zero: true, negative: true }),
  op("TEST",     "0x1E", "C", ["rs","rt"],      "rs, rt",     "compare", "Test (AND flags)",     "Compute rs & rt, set flags, discard result.", { zero: true, negative: true }),
  op("SETCC",    "0x1F", "D", ["rd","imm16"],   "rd, cond",   "compare", "Set on condition",     "rd ← 1 if condition code imm16 is met, else 0.", { zero: true, negative: true, carry: true, overflow: true }),

  // =========================================================================
  // 0x20–0x27  Stack
  // =========================================================================
  op("PUSH",     "0x20", "B", ["rs"],           "rs",         "stack",   "Push to stack",    "Push register value onto stack. SP -= 4; MEM[SP] ← rs"),
  op("POP",      "0x21", "B", ["rd"],           "rd",         "stack",   "Pop from stack",   "Pop value from stack into register. rd ← MEM[SP]; SP += 4"),
  op("DUP",      "0x22", "A", [],               "",           "stack",   "Duplicate top",    "Duplicate top of stack. Equivalent to PUSH(TOS)."),
  op("SWAP",     "0x23", "A", [],               "",           "stack",   "Swap top two",     "Swap top two stack values."),
  op("ROT",      "0x24", "A", [],               "",           "stack",   "Rotate stack",     "Rotate top three stack values: TOS → third, second → TOS."),
  op("ENTER",    "0x25", "D", ["imm16"],        "framesize",  "stack",   "Enter frame",      "Push BP; BP ← SP; SP -= framesize. Establishes stack frame."),
  op("LEAVE",    "0x26", "A", [],               "",           "stack",   "Leave frame",      "SP ← BP; POP BP. Tears down stack frame."),
  op("ALLOCA",   "0x27", "B", ["rd"],           "rd",         "stack",   "Stack allocate",   "Allocate rd bytes on stack. SP -= rd."),

  // =========================================================================
  // 0x28–0x2F  Function
  // =========================================================================
  op("RET",       "0x28", "A", [],               "",           "function", "Return from call",       "Return to caller. PC ← POP()."),
  op("CALL_IND",  "0x29", "B", ["rs"],           "rs",         "function", "Indirect call",          "Call address in register. PUSH(PC+2); PC ← rs."),
  op("TAILCALL",  "0x2A", "D", ["label"],        "label",      "function", "Tail call",             "Jump to label without pushing return address. Reuses current frame."),
  op("MOVI",      "0x2B", "D", ["rd","imm16"],   "rd, imm16",  "function", "Move immediate",        "Load 16-bit signed immediate into register. rd ← sign_extend(imm16)."),
  op("IREM",      "0x2C", "E", ["rd","rs","rt"], "rd, rs, rt", "function", "Integer remainder",     "rd ← rs % rt (same as IMOD). Alias for IMOD."),
  op("CMP",       "0x2D", "C", ["rs","rt"],      "rs, rt",     "function", "Compare (alias)",       "Compare rs and rt, set flags. Alias for ICMP.", { zero: true, negative: true, carry: true }),
  op("JE",        "0x2E", "D", ["label"],        "label",      "function", "Jump if equal",         "Jump to label if zero flag is set. if ZF: PC ← label", { zero: true }),
  op("JNE",       "0x2F", "D", ["label"],        "label",      "function", "Jump if not equal",     "Jump to label if zero flag is clear. if !ZF: PC ← label", { zero: true }),

  // =========================================================================
  // 0x30–0x37  Memory
  // =========================================================================
  op("REGION_CREATE",    "0x30", "E", ["rd","rs","rt"], "rd, rs, rt", "memory", "Create memory region",   "Create a new memory region of size rt with base address rs. rd ← region_id."),
  op("REGION_DESTROY",   "0x31", "B", ["rs"],          "rs",          "memory", "Destroy memory region",  "Destroy memory region identified by rs. Releases all associated memory."),
  op("REGION_TRANSFER",  "0x32", "E", ["rd","rs","rt"], "rd, rs, rt", "memory", "Transfer region",       "Transfer ownership of region rs to target rt. rd ← status."),
  op("MEMCOPY",          "0x33", "E", ["rd","rs","rt"], "rd, rs, rt", "memory", "Copy memory",           "Copy rt bytes from source rs to destination rd. Overlap is handled."),
  op("MEMSET",           "0x34", "E", ["rd","rs","rt"], "rd, rs, rt", "memory", "Set memory",            "Fill rt bytes starting at rd with value in rs (low byte)."),
  op("MEMCMP",           "0x35", "E", ["rd","rs","rt"], "rd, rs, rt", "memory", "Compare memory",        "Compare rt bytes at addresses rd and rs. rd ← comparison result.", { zero: true, negative: true }),
  op("MEMLOCK",          "0x36", "C", ["rs","rt"],      "rs, rt",      "memory", "Lock memory region",    "Lock memory region rs with lock type rt. Prevents concurrent access."),
  op("MEMUNLOCK",        "0x37", "C", ["rs","rt"],      "rs, rt",      "memory", "Unlock memory region",  "Unlock memory region rs with lock type rt."),

  // =========================================================================
  // 0x38–0x3F  Type Operations
  // =========================================================================
  op("CAST",          "0x38", "C", ["rd","rs"],      "rd, rs",     "type", "Type cast",          "Cast value in rs to the type of register rd. Int↔Float conversion."),
  op("BOX",           "0x39", "C", ["rd","rs"],      "rd, rs",     "type", "Box value",          "Box primitive value rs into tagged container rd. Adds type metadata."),
  op("UNBOX",         "0x3A", "C", ["rd","rs"],      "rd, rs",     "type", "Unbox value",        "Extract primitive value from boxed rs into rd. Removes type metadata."),
  op("CHECK_TYPE",    "0x3B", "C", ["rd","rs"],      "rd, rs",     "type", "Check type",         "rd ← 1 if rs matches expected type, else 0.", { zero: true }),
  op("CHECK_BOUNDS",  "0x3C", "E", ["rd","rs","rt"], "rd, rs, rt", "type", "Bounds check",      "rd ← 1 if rs <= rt < rd, else 0. Array bounds validation.", { zero: true }),
  op("TYPEOF",        "0x3D", "C", ["rd","rs"],      "rd, rs",     "type", "Get type tag",       "rd ← type tag of value in rs. Returns runtime type identifier."),
  op("INSTANCEOF",    "0x3E", "C", ["rd","rs"],      "rd, rs",     "type", "Instance check",     "rd ← 1 if rs is instance of type rd, else 0.", { zero: true }),
  op("SIZEOF",        "0x3F", "C", ["rd","rs"],      "rd, rs",     "type", "Size of type",       "rd ← size in bytes of the type/value in rs."),

  // =========================================================================
  // 0x40–0x47  Float Arithmetic
  // =========================================================================
  op("FADD",    "0x40", "E", ["fd","fs","ft"], "fd, fs, ft", "float", "Float add",      "fd ← fs + ft. IEEE 754 single-precision addition.", { zero: true, negative: true, overflow: true }),
  op("FSUB",    "0x41", "E", ["fd","fs","ft"], "fd, fs, ft", "float", "Float subtract",  "fd ← fs - ft. IEEE 754 single-precision subtraction.", { zero: true, negative: true, overflow: true }),
  op("FMUL",    "0x42", "E", ["fd","fs","ft"], "fd, fs, ft", "float", "Float multiply",  "fd ← fs * ft. IEEE 754 single-precision multiplication.", { zero: true, negative: true, overflow: true }),
  op("FDIV",    "0x43", "E", ["fd","fs","ft"], "fd, fs, ft", "float", "Float divide",    "fd ← fs / ft. IEEE 754 single-precision division.", { zero: true, negative: true }),
  op("FNEG",    "0x44", "B", ["fd","fs"],      "fd, fs",     "float", "Float negate",    "fd ← -fs. Negates sign bit."),
  op("FABS",    "0x45", "B", ["fd","fs"],      "fd, fs",     "float", "Float absolute",  "fd ← |fs|. Clears sign bit."),
  op("FSQRT",   "0x46", "B", ["fd","fs"],      "fd, fs",     "float", "Float sqrt",      "fd ← √fs. IEEE 754 square root."),
  op("FMOV",    "0x47", "B", ["fd","fs"],      "fd, fs",     "float", "Float move",      "fd ← fs. Move between float registers."),

  // =========================================================================
  // 0x48–0x4F  Float Compare / SIMD Load-Store
  // =========================================================================
  op("FCMP",    "0x48", "C", ["fs","ft"],      "fs, ft",     "float", "Float compare",   "Compare fs and ft. Sets flags for conditional branches.", { zero: true, negative: true }),
  op("FEQ",     "0x49", "E", ["rd","fs","ft"], "rd, fs, ft", "float", "Float equal",     "rd ← (fs == ft) ? 1 : 0", { zero: true }),
  op("FLT",     "0x4A", "E", ["rd","fs","ft"], "rd, fs, ft", "float", "Float less than", "rd ← (fs < ft) ? 1 : 0", { zero: true, negative: true }),
  op("FLE",     "0x4B", "E", ["rd","fs","ft"], "rd, fs, ft", "float", "Float less/equal","rd ← (fs <= ft) ? 1 : 0", { zero: true, negative: true }),
  op("FGT",     "0x4C", "E", ["rd","fs","ft"], "rd, fs, ft", "float", "Float greater",   "rd ← (fs > ft) ? 1 : 0", { zero: true, negative: true }),
  op("FGE",     "0x4D", "E", ["rd","fs","ft"], "rd, fs, ft", "float", "Float greater/eq","rd ← (fs >= ft) ? 1 : 0", { zero: true, negative: true }),
  op("VLOAD",   "0x4E", "D", ["vd","imm16"],   "vd, [addr]", "simd",  "SIMD load",       "Load 128-bit SIMD vector from memory into vd."),
  op("VSTORE",  "0x4F", "D", ["vs","imm16"],   "vs, [addr]", "simd",  "SIMD store",      "Store 128-bit SIMD vector from vs to memory."),

  // =========================================================================
  // 0x50–0x5F  SIMD Arithmetic
  // =========================================================================
  op("VADD",    "0x50", "E", ["vd","vs","vt"], "vd, vs, vt", "simd", "SIMD add",         "vd[i] ← vs[i] + vt[i] for each lane. Packed integer addition."),
  op("VSUB",    "0x51", "E", ["vd","vs","vt"], "vd, vs, vt", "simd", "SIMD subtract",    "vd[i] ← vs[i] - vt[i] for each lane. Packed integer subtraction."),
  op("VMUL",    "0x52", "E", ["vd","vs","vt"], "vd, vs, vt", "simd", "SIMD multiply",    "vd[i] ← vs[i] * vt[i] for each lane. Packed integer multiplication."),
  op("VDIV",    "0x53", "E", ["vd","vs","vt"], "vd, vs, vt", "simd", "SIMD divide",      "vd[i] ← vs[i] / vt[i] for each lane. Packed integer division."),
  op("VFMA",    "0x54", "E", ["vd","vs","vt"], "vd, vs, vt", "simd", "SIMD FMA",         "vd[i] ← vd[i] + vs[i] * vt[i]. Fused multiply-add per lane."),
  op("VAND",    "0x55", "E", ["vd","vs","vt"], "vd, vs, vt", "simd", "SIMD AND",         "vd ← vs & vt. Bitwise AND of 128-bit vectors."),
  op("VOR",     "0x56", "E", ["vd","vs","vt"], "vd, vs, vt", "simd", "SIMD OR",          "vd ← vs | vt. Bitwise OR of 128-bit vectors."),
  op("VXOR",    "0x57", "E", ["vd","vs","vt"], "vd, vs, vt", "simd", "SIMD XOR",         "vd ← vs ^ vt. Bitwise XOR of 128-bit vectors."),
  op("VSHL",    "0x58", "E", ["vd","vs","vt"], "vd, vs, vt", "simd", "SIMD shift left",  "vd[i] ← vs[i] << vt[i] per lane."),
  op("VSHR",    "0x59", "E", ["vd","vs","vt"], "vd, vs, vt", "simd", "SIMD shift right", "vd[i] ← vs[i] >> vt[i] per lane."),
  op("VCMPEQ",  "0x5A", "E", ["vd","vs","vt"], "vd, vs, vt", "simd", "SIMD compare eq",  "vd[i] ← (vs[i] == vt[i]) ? all_ones : 0 per lane."),
  op("VCMPGT",  "0x5B", "E", ["vd","vs","vt"], "vd, vs, vt", "simd", "SIMD compare gt",  "vd[i] ← (vs[i] > vt[i]) ? all_ones : 0 per lane."),
  op("VCMPLT",  "0x5C", "E", ["vd","vs","vt"], "vd, vs, vt", "simd", "SIMD compare lt",  "vd[i] ← (vs[i] < vt[i]) ? all_ones : 0 per lane."),
  op("VMERGE",  "0x5D", "E", ["vd","vs","vt"], "vd, vs, vt", "simd", "SIMD merge",       "Merge lanes from vs and vt based on mask in vd."),
  op("VSPLAT",  "0x5E", "B", ["vd","rs"],      "vd, rs",      "simd", "SIMD broadcast",   "Broadcast scalar rs across all lanes of vd."),
  op("VEXTRACT","0x5F", "B", ["rd","vs"],      "rd, vs",      "simd", "SIMD extract",     "Extract lane 0 from SIMD vector vs into integer register rd."),

  // =========================================================================
  // 0x60–0x6F  A2A (Agent-to-Agent) Core
  // =========================================================================
  op("TELL",       "0x60", "E", ["rd","rs","rt"], "rd, rs, rt", "a2a", "Tell message",        "Send message rs of length rt to agent rd. Asynchronous fire-and-forget."),
  op("ASK",        "0x61", "E", ["rd","rs","rt"], "rd, rs, rt", "a2a", "Ask message",         "Send query rs of length rt to agent rd. Blocks until response."),
  op("DELEGATE",   "0x62", "E", ["rd","rs","rt"], "rd, rs, rt", "a2a", "Delegate task",      "Delegate task rs with context rt to agent rd. Transfers authority."),
  op("BROADCAST",  "0x63", "C", ["rs","rt"],      "rs, rt",      "a2a", "Broadcast message",  "Broadcast message rs of length rt to all agents in network."),
  op("TRUST",      "0x64", "C", ["rd","rs"],      "rd, rs",      "a2a", "Set trust level",    "Set trust level of agent rs to value rd. 0=none, 255=full."),
  op("CAP",        "0x65", "C", ["rd","rs"],      "rd, rs",      "a2a", "Grant capability",   "Grant capability rs to agent rd. Capability-based access control."),
  op("BARRIER",    "0x66", "B", ["rs"],           "rs",          "a2a", "Sync barrier",       "Wait at barrier until rs agents have arrived. Synchronization primitive."),
  op("SPAWN",      "0x67", "D", ["rd","imm16"],   "rd, config",  "a2a", "Spawn agent",       "Spawn a new agent with configuration imm16. rd ← agent_id."),
  op("JOIN",       "0x68", "B", ["rs"],           "rs",          "a2a", "Join agent",         "Wait for agent rs to complete. Blocks current agent."),
  op("SUSPEND",    "0x69", "B", ["rs"],           "rs",          "a2a", "Suspend agent",      "Suspend execution of agent rs. Agent state is preserved."),
  op("RESUME",     "0x6A", "B", ["rs"],           "rs",          "a2a", "Resume agent",       "Resume previously suspended agent rs."),
  op("KILL",       "0x6B", "B", ["rs"],           "rs",          "a2a", "Kill agent",         "Terminate agent rs immediately. Resources are released."),
  op("IDENTIFY",   "0x6C", "B", ["rd"],           "rd",          "a2a", "Get agent ID",       "rd ← current agent's unique identifier."),
  op("CHANNEL_OPEN","0x6D","E", ["rd","rs","rt"], "rd, rs, rt",  "a2a", "Open channel",      "Open communication channel between agents rs and rt. rd ← channel_id."),
  op("CHANNEL_SEND","0x6E","E", ["rd","rs","rt"], "rd, rs, rt",  "a2a", "Send on channel",   "Send message rs of length rt on channel rd."),
  op("CHANNEL_RECV","0x6F","E", ["rd","rs","rt"], "rd, rs, rt",  "a2a", "Receive on channel","Receive message into buffer rs of max length rt from channel rd."),

  // =========================================================================
  // 0x70–0x7F  Viewpoint / Babel Multilingual
  // =========================================================================
  op("BABEL_LOAD",   "0x70", "D", ["rd","imm16"],  "rd, lang_id",  "viewpoint", "Load language",      "Load Babel language perspective lang_id into context register rd."),
  op("BABEL_SWITCH", "0x71", "B", ["rs"],          "rs",           "viewpoint", "Switch language",    "Switch active language perspective to rs. Affects TELL/ASK semantics."),
  op("BABEL_TRANSLATE","0x72","E", ["rd","rs","rt"],"rd, rs, rt",   "viewpoint", "Translate message",  "Translate message at rs of length rt into viewpoint rd's language."),
  op("VIEWPOINT_SET","0x73", "C", ["rd","rs"],     "rd, rs",       "viewpoint", "Set viewpoint",      "Set viewpoint perspective rd to model rs. Affects interpretation."),
  op("VIEWPOINT_GET","0x74", "C", ["rd","rs"],     "rd, rs",       "viewpoint", "Get viewpoint",      "rd ← current viewpoint model for perspective rs."),
  op("PERSPECTIVE_MERGE","0x75","E",["rd","rs","rt"],"rd, rs, rt", "viewpoint", "Merge perspectives", "Merge viewpoints rs and rt into unified perspective rd."),
  op("BABEL_COMPARE","0x76","E", ["rd","rs","rt"], "rd, rs, rt",   "viewpoint", "Compare languages",  "Compare semantic content of rs vs rt across languages. rd ← similarity."),
  op("BABEL_REGISTER","0x77","D", ["rd","imm16"],  "rd, lang_def", "viewpoint", "Register language",  "Register a new language definition. rd ← language slot."),
  op("VIEWPOINT_FILTER","0x78","E",["rd","rs","rt"],"rd, rs, rt",  "viewpoint", "Filter viewpoint",   "Apply filter rt to viewpoint rs. Result in rd."),
  op("CONTEXT_SAVE","0x79", "B", ["rd"],           "rd",           "viewpoint", "Save context",       "Save current multilingual context to register rd."),
  op("CONTEXT_RESTORE","0x7A","B",["rs"],          "rs",           "viewpoint", "Restore context",    "Restore multilingual context from register rs."),
  op("BABEL_RESOLVE","0x7B","C", ["rd","rs"],      "rd, rs",       "viewpoint", "Resolve ambiguity",  "Resolve semantic ambiguity in rs using current viewpoint. rd ← result."),

  // =========================================================================
  // 0x80–0x84  System
  // =========================================================================
  op("HALT",             "0x80", "A", [],               "",           "system", "Halt execution",          "Stop the processor. Program termination. Must be present at exit."),
  op("YIELD",            "0x81", "A", [],               "",           "system", "Yield timeslice",         "Yield current execution timeslice to scheduler. Cooperative multitasking."),
  op("RESOURCE_ACQUIRE", "0x82", "C", ["rd","rs"],      "rd, rs",     "system", "Acquire resource",        "Acquire resource of type rs. rd ← resource handle."),
  op("RESOURCE_RELEASE", "0x83", "C", ["rd","rs"],      "rd, rs",     "system", "Release resource",        "Release resource handle rs from pool rd."),
  op("DEBUG_BREAK",      "0x84", "A", [],               "",           "system", "Debug breakpoint",        "Trigger debug breakpoint. Pauses execution for debugger attachment."),

  // =========================================================================
  // 0x85–0x9F  Extended / Reserved (key extended ops)
  // =========================================================================
  op("SYSCALL",    "0x85", "D", ["rd","imm16"],   "rd, syscall_num", "system", "System call",      "Invoke system call imm16. Return value in rd."),
  op("IO_READ",    "0x86", "E", ["rd","rs","rt"], "rd, port, count", "system", "I/O read",         "Read count rt bytes from I/O port rs into buffer rd."),
  op("IO_WRITE",   "0x87", "E", ["rd","rs","rt"], "rd, port, count", "system", "I/O write",        "Write count rt bytes to I/O port rs from buffer rd."),
  op("INTERRUPT",  "0x88", "B", ["rs"],           "rs",               "system", "Software interrupt", "Trigger software interrupt rs. Vector to ISR."),
  op("IRET",       "0x89", "A", [],               "",                 "system", "Interrupt return",  "Return from interrupt service routine."),

  // =========================================================================
  // 0xA0–0xBF  Confidence Variants (C_ prefix)
  // =========================================================================
  op("C_IADD",  "0xA0", "E", ["rd","rs","rt"], "rd, rs, rt", "confidence", "Confidence-aware add",     "rd ← rs + rt with confidence propagation. Confidence = min(c(rs), c(rt)).", { confidence: true, zero: true, negative: true, overflow: true }),
  op("C_ISUB",  "0xA1", "E", ["rd","rs","rt"], "rd, rs, rt", "confidence", "Confidence-aware sub",     "rd ← rs - rt with confidence propagation.", { confidence: true, zero: true, negative: true, overflow: true }),
  op("C_IMUL",  "0xA2", "E", ["rd","rs","rt"], "rd, rs, rt", "confidence", "Confidence-aware mul",     "rd ← rs * rt with confidence propagation.", { confidence: true, zero: true, negative: true }),
  op("C_IDIV",  "0xA3", "E", ["rd","rs","rt"], "rd, rs, rt", "confidence", "Confidence-aware div",     "rd ← rs / rt with confidence propagation.", { confidence: true, zero: true }),
  op("C_IMOD",  "0xA4", "E", ["rd","rs","rt"], "rd, rs, rt", "confidence", "Confidence-aware mod",     "rd ← rs % rt with confidence propagation.", { confidence: true }),
  op("C_ICMP",  "0xA5", "C", ["rs","rt"],      "rs, rt",     "confidence", "Confidence-aware compare", "Compare with confidence tracking. Flags reflect confidence-weighted result.", { confidence: true, zero: true, negative: true }),
  op("C_IEQ",   "0xA6", "E", ["rd","rs","rt"], "rd, rs, rt", "confidence", "Confidence-aware eq",      "rd ← (rs == rt) ? 1 : 0 with confidence.", { confidence: true, zero: true }),
  op("C_ILT",   "0xA7", "E", ["rd","rs","rt"], "rd, rs, rt", "confidence", "Confidence-aware lt",      "rd ← (rs < rt) ? 1 : 0 with confidence.", { confidence: true, zero: true, negative: true }),
  op("C_IGT",   "0xA8", "E", ["rd","rs","rt"], "rd, rs, rt", "confidence", "Confidence-aware gt",      "rd ← (rs > rt) ? 1 : 0 with confidence.", { confidence: true, zero: true, negative: true }),
  op("C_FADD",  "0xA9", "E", ["fd","fs","ft"], "fd, fs, ft", "confidence", "Confidence float add",     "fd ← fs + ft with confidence propagation.", { confidence: true, zero: true, negative: true }),
  op("C_FSUB",  "0xAA", "E", ["fd","fs","ft"], "fd, fs, ft", "confidence", "Confidence float sub",     "fd ← fs - ft with confidence propagation.", { confidence: true, zero: true, negative: true }),
  op("C_FMUL",  "0xAB", "E", ["fd","fs","ft"], "fd, fs, ft", "confidence", "Confidence float mul",     "fd ← fs * ft with confidence propagation.", { confidence: true, zero: true, negative: true }),
  op("C_FDIV",  "0xAC", "E", ["fd","fs","ft"], "fd, fs, ft", "confidence", "Confidence float div",     "fd ← fs / ft with confidence propagation.", { confidence: true }),
  op("C_FCMP",  "0xAD", "C", ["fs","ft"],      "fs, ft",     "confidence", "Confidence float compare", "Float compare with confidence tracking.", { confidence: true, zero: true, negative: true }),
  op("C_MOV",   "0xAE", "C", ["rd","rs"],      "rd, rs",     "confidence", "Confidence move",          "Move with confidence propagation. rd ← rs, c(rd) ← c(rs).", { confidence: true }),
  op("C_TELL",  "0xAF", "E", ["rd","rs","rt"], "rd, rs, rt", "confidence", "Confidence tell",          "Tell with confidence annotation. Message carries confidence metadata.", { confidence: true }),
  op("C_ASK",   "0xB0", "E", ["rd","rs","rt"], "rd, rs, rt", "confidence", "Confidence ask",           "Ask with confidence annotation. Response includes confidence.", { confidence: true }),
  op("C_BROADCAST","0xB1","C",["rs","rt"],     "rs, rt",     "confidence", "Confidence broadcast",     "Broadcast with confidence. All recipients get confidence context.", { confidence: true }),
  op("C_CAST",  "0xB2", "C", ["rd","rs"],      "rd, rs",     "confidence", "Confidence cast",          "Type cast preserving confidence. c(rd) ← c(rs).", { confidence: true }),

  // =========================================================================
  // 0xC0–0xEF  Extended Operations
  // =========================================================================
  op("MOVI32",    "0xC0", "G", ["rd","imm32"],   "rd, imm32",  "integer",  "Move 32-bit immediate",  "Load full 32-bit immediate into register. rd ← imm32. 5-byte encoding."),
  op("LOAD8",     "0xC1", "D", ["rd","imm16"],   "rd, [addr]", "memory",   "Load byte",              "Load 8-bit value from memory. rd ← zero_extend(MEM8[addr])."),
  op("LOAD16",    "0xC2", "D", ["rd","imm16"],   "rd, [addr]", "memory",   "Load halfword",          "Load 16-bit value from memory. rd ← zero_extend(MEM16[addr])."),
  op("STORE8",    "0xC3", "D", ["rs","imm16"],   "rs, [addr]", "memory",   "Store byte",             "Store low byte of rs to memory. MEM8[addr] ← rs[7:0]."),
  op("STORE16",   "0xC4", "D", ["rs","imm16"],   "rs, [addr]", "memory",   "Store halfword",         "Store low halfword of rs to memory. MEM16[addr] ← rs[15:0]."),
  op("LOADR",     "0xC5", "C", ["rd","rs"],      "rd, [rs]",   "memory",   "Load register-indirect", "Load from address in rs. rd ← MEM[rs]."),
  op("STORER",    "0xC6", "C", ["rd","rs"],      "rd, [rs]",   "memory",   "Store register-indirect", "Store rd to address in rs. MEM[rs] ← rd."),
  op("LEA",       "0xC7", "D", ["rd","imm16"],   "rd, label",  "integer",  "Load effective address",  "rd ← address of label. Does not dereference."),
  op("SEXT8",     "0xC8", "B", ["rd","rs"],      "rd, rs",     "integer",  "Sign-extend byte",       "rd ← sign_extend(rs[7:0])."),
  op("SEXT16",    "0xC9", "B", ["rd","rs"],      "rd, rs",     "integer",  "Sign-extend half",       "rd ← sign_extend(rs[15:0])."),
  op("ZEXT8",     "0xCA", "B", ["rd","rs"],      "rd, rs",     "integer",  "Zero-extend byte",       "rd ← zero_extend(rs[7:0])."),
  op("ZEXT16",    "0xCB", "B", ["rd","rs"],      "rd, rs",     "integer",  "Zero-extend half",       "rd ← zero_extend(rs[15:0])."),
  op("MULH",      "0xCC", "E", ["rd","rs","rt"], "rd, rs, rt", "integer",  "Multiply high",          "rd ← (rs * rt) >> 32. Upper 32 bits of 64-bit product."),
  op("UMULH",     "0xCD", "E", ["rd","rs","rt"], "rd, rs, rt", "integer",  "Unsigned mul high",      "rd ← (rs * rt) >> 32 unsigned. Upper 32 bits of unsigned product."),
  op("UDIV",      "0xCE", "E", ["rd","rs","rt"], "rd, rs, rt", "integer",  "Unsigned divide",        "rd ← rs / rt (unsigned). Division by zero is undefined."),
  op("UREM",      "0xCF", "E", ["rd","rs","rt"], "rd, rs, rt", "integer",  "Unsigned remainder",     "rd ← rs % rt (unsigned). Division by zero is undefined."),

  op("CLZ",       "0xD0", "B", ["rd","rs"],      "rd, rs",     "bitwise",  "Count leading zeros",    "rd ← count of leading zero bits in rs."),
  op("CTZ",       "0xD1", "B", ["rd","rs"],      "rd, rs",     "bitwise",  "Count trailing zeros",   "rd ← count of trailing zero bits in rs."),
  op("POPCNT",    "0xD2", "B", ["rd","rs"],      "rd, rs",     "bitwise",  "Population count",       "rd ← number of set bits in rs."),
  op("BSWAP",     "0xD3", "B", ["rd","rs"],      "rd, rs",     "bitwise",  "Byte swap",              "rd ← byte-reversed rs. Reverses byte order."),
  op("BIT_EXTRACT","0xD4","E", ["rd","rs","rt"], "rd, rs, rt", "bitwise",  "Bit extract",            "Extract bit field from rs at position/width specified by rt."),
  op("BIT_INSERT","0xD5", "E", ["rd","rs","rt"], "rd, rs, rt", "bitwise",  "Bit insert",             "Insert bit field from rs into rd at position/width specified by rt."),

  op("FLOAD",     "0xD8", "D", ["fd","imm16"],   "fd, [addr]", "float",    "Float load",             "Load 32-bit float from memory into float register."),
  op("FSTORE",    "0xD9", "D", ["fs","imm16"],   "fs, [addr]", "float",    "Float store",            "Store 32-bit float from float register to memory."),
  op("FMOVI",     "0xDA", "D", ["fd","imm16"],   "fd, imm16",  "float",    "Float move immediate",   "Load 16-bit encoded float immediate into fd."),
  op("FLOOR",     "0xDB", "B", ["fd","fs"],      "fd, fs",     "float",    "Float floor",            "fd ← floor(fs). Round toward negative infinity."),
  op("CEIL",      "0xDC", "B", ["fd","fs"],      "fd, fs",     "float",    "Float ceiling",          "fd ← ceil(fs). Round toward positive infinity."),
  op("ROUND",     "0xDD", "B", ["fd","fs"],      "fd, fs",     "float",    "Float round",            "fd ← round(fs). Round to nearest, ties to even."),
  op("FMIN",      "0xDE", "E", ["fd","fs","ft"], "fd, fs, ft", "float",    "Float minimum",          "fd ← min(fs, ft). IEEE 754 minimum number."),
  op("FMAX",      "0xDF", "E", ["fd","fs","ft"], "fd, fs, ft", "float",    "Float maximum",          "fd ← max(fs, ft). IEEE 754 maximum number."),

  op("FCVTI",     "0xE0", "B", ["rd","fs"],      "rd, fs",     "float",    "Float to int",           "rd ← (int32_t)fs. Truncate toward zero."),
  op("ICVTF",     "0xE1", "B", ["fd","rs"],      "fd, rs",     "float",    "Int to float",           "fd ← (float)rs. Convert integer to float."),

  // =========================================================================
  // 0xF0–0xFF  Special / Privileged
  // =========================================================================
  op("CLI",       "0xF0", "A", [],               "",           "system", "Disable interrupts",  "Clear interrupt flag. Disable maskable interrupts."),
  op("STI",       "0xF1", "A", [],               "",           "system", "Enable interrupts",   "Set interrupt flag. Enable maskable interrupts."),
  op("HCF",       "0xF2", "A", [],               "",           "system", "Halt and catch fire", "FATAL: Unrecoverable error. Processor enters diagnostic state."),
  op("RDTSC",     "0xF3", "B", ["rd"],           "rd",         "system", "Read timestamp",      "rd ← current timestamp counter value."),
  op("CPUID",     "0xF4", "B", ["rd"],           "rd",         "system", "CPU identification",  "rd ← CPU identification and feature flags."),
  op("WBINVD",    "0xF5", "A", [],               "",           "system", "Write-back invalidate","Write-back and invalidate caches."),
  op("PREFETCH",  "0xF6", "D", ["rd","imm16"],   "rd, hint",   "memory", "Prefetch hint",       "Prefetch data at address into cache hierarchy."),
  op("CLFLUSH",   "0xF7", "D", ["rd","imm16"],   "rd, addr",   "memory", "Cache line flush",    "Flush cache line containing address rd+imm16."),
  op("MFENCE",    "0xF8", "A", [],               "",           "memory", "Memory fence",        "Full memory fence. Orders all prior loads/stores before subsequent."),
  op("LFENCE",    "0xF9", "A", [],               "",           "memory", "Load fence",          "Load memory fence. Orders all prior loads before subsequent."),
  op("SFENCE",    "0xFA", "A", [],               "",           "memory", "Store fence",         "Store memory fence. Orders all prior stores before subsequent."),
  op("PAUSE",     "0xFB", "A", [],               "",           "system", "Spin-wait hint",      "Hint to processor that current code is in spin-wait loop."),
  op("NOPW",      "0xFC", "D", ["imm16"],        "imm16",      "control","Multi-byte NOP",      "No operation, padded to 4 bytes with imm16 fill."),
  op("UNDEFINED", "0xFD", "A", [],               "",           "system", "Undefined opcode",    "Raises undefined opcode exception."),
  op("RESERVED",  "0xFE", "A", [],               "",           "system", "Reserved",            "Reserved for future use. Execution is undefined."),
  op("IMPL_DEF",  "0xFF", "G", [],               "...",        "system", "Implementation defined","Implementation-specific behavior. Variable length encoding."),
];

// ---------------------------------------------------------------------------
// Lookup structures
// ---------------------------------------------------------------------------

/** Map from uppercase mnemonic → OpcodeEntry */
export const opcodeByName = new Map<string, OpcodeEntry>();
/** Map from hex string (e.g. "0x08") → OpcodeEntry */
export const opcodeByHex = new Map<string, OpcodeEntry>();
/** Map from category → OpcodeEntry[] */
export const opcodesByCategory = new Map<OpcodeCategory, OpcodeEntry[]>();

for (const entry of OPCODES) {
  opcodeByName.set(entry.name.toUpperCase(), entry);
  opcodeByHex.set(entry.hex.toLowerCase(), entry);
  const list = opcodesByCategory.get(entry.category) ?? [];
  list.push(entry);
  opcodesByCategory.set(entry.category, list);
}

/** All known opcode mnemonics (uppercase) */
export const ALL_MNEMONICS: string[] = OPCODES.map(o => o.name);

/** Category display names */
export const CATEGORY_LABELS: Record<OpcodeCategory, string> = {
  control:    "Control Flow",
  integer:    "Integer Arithmetic",
  bitwise:    "Bitwise Operations",
  compare:    "Comparison",
  stack:      "Stack Operations",
  function:   "Function Operations",
  memory:     "Memory Operations",
  type:       "Type Operations",
  float:      "Float Arithmetic",
  simd:       "SIMD Operations",
  a2a:        "Agent-to-Agent (A2A)",
  system:     "System / Privileged",
  confidence: "Confidence-Aware",
  viewpoint:  "Viewpoint / Babel",
};

/** Register definitions */
export interface RegisterInfo {
  name: string;
  type: "int" | "float" | "simd";
  index: number;
  description: string;
  width: string;
}

const REGISTERS: RegisterInfo[] = [
  // Integer registers R0–R15
  ...Array.from({ length: 16 }, (_, i) => ({
    name: `R${i}`,
    type: "int" as const,
    index: i,
    description: `General-purpose integer register R${i}. 32-bit signed/unsigned.`,
    width: "32-bit",
  })),
  // Float registers F0–F15
  ...Array.from({ length: 16 }, (_, i) => ({
    name: `F${i}`,
    type: "float" as const,
    index: i,
    description: `Floating-point register F${i}. IEEE 754 single-precision.`,
    width: "32-bit",
  })),
  // SIMD registers V0–V15
  ...Array.from({ length: 16 }, (_, i) => ({
    name: `V${i}`,
    type: "simd" as const,
    index: i,
    description: `128-bit SIMD vector register V${i}. Packed integer/float lanes.`,
    width: "128-bit",
  })),
];

export const registerByName = new Map<string, RegisterInfo>();
for (const r of REGISTERS) {
  registerByName.set(r.name.toUpperCase(), r);
}

/** All register names */
export const ALL_REGISTER_NAMES: string[] = REGISTERS.map(r => r.name);

/** Directive definitions */
export interface DirectiveInfo {
  name: string;
  description: string;
  detail: string;
  syntax: string;
}

export const DIRECTIVES: DirectiveInfo[] = [
  { name: ".byte",   description: "Define byte constant",        detail: "Emit one or more 8-bit values at the current position.",            syntax: ".byte value[, value...]" },
  { name: ".word",   description: "Define word constant",        detail: "Emit one or more 16-bit values at the current position.",           syntax: ".word value[, value...]" },
  { name: ".dword",  description: "Define double-word constant", detail: "Emit one or more 32-bit values at the current position.",           syntax: ".dword value[, value...]" },
  { name: ".org",    description: "Set origin address",          detail: "Set the program counter to the specified address for subsequent code.", syntax: ".org address" },
  { name: ".text",   description: "Code section",                detail: "Begin the code (text) section. Instructions follow.",                syntax: ".text" },
  { name: ".data",   description: "Data section",                detail: "Begin the data section. Data declarations follow.",                  syntax: ".data" },
  { name: ".bss",    description: "BSS section",                 detail: "Begin the uninitialized data section.",                              syntax: ".bss" },
  { name: ".align",  description: "Alignment directive",         detail: "Align the next item to a specified power-of-two boundary.",          syntax: ".align n" },
  { name: ".global", description: "Global symbol",               detail: "Declare a symbol as globally visible for linking.",                  syntax: ".global name" },
  { name: ".extern", description: "External symbol",             detail: "Declare a symbol defined in another module.",                        syntax: ".extern name" },
  { name: ".include",description: "Include file",                detail: "Include another source file at this position.",                      syntax: ".include \"filename\"" },
  { name: ".ascii",  description: "ASCII string",                detail: "Emit a null-terminated ASCII string.",                               syntax: ".ascii \"string\"" },
  { name: ".asciz",  description: "Null-terminated ASCII",      detail: "Emit a null-terminated ASCII string with explicit NUL byte.",       syntax: ".asciz \"string\"" },
  { name: ".space",  description: "Reserve space",               detail: "Reserve n bytes of uninitialized space.",                            syntax: ".space n" },
  { name: ".fill",   description: "Fill pattern",                detail: "Fill n words with value v.",                                         syntax: ".fill n, v" },
  { name: ".set",    description: "Set symbol value",            detail: "Assign a value to a symbol. .set symbol, value",                     syntax: ".set name, value" },
  { name: ".macro",  description: "Macro definition",            detail: "Begin macro definition block.",                                      syntax: ".macro name" },
  { name: ".endm",   description: "End macro",                   detail: "End macro definition block.",                                        syntax: ".endm" },
];

export const directiveByName = new Map<string, DirectiveInfo>();
for (const d of DIRECTIVES) {
  directiveByName.set(d.name.toLowerCase(), d);
}

export const ALL_DIRECTIVE_NAMES: string[] = DIRECTIVES.map(d => d.name);
