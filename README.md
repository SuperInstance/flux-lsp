# FLUX LSP — Language Server Protocol for .fluxasm

**Task T-006** | **Fleet**: SuperInstance/Cocapn | **ISA**: FLUX v1.0/v3.0

A complete Language Server Protocol implementation for FLUX ISA assembly files (`.fluxasm`). Provides real-time intelligence for editing, debugging, and developing FLUX assembly programs.

---

## Features

### Diagnostics
- **Unknown opcode detection** — with Levenshtein-based typo suggestions
- **Invalid register format** — out-of-range indices (e.g. R16), wrong register type
- **Wrong operand count** — validates against instruction format specification
- **Duplicate label detection** — flags redefined labels with reference to first occurrence
- **Missing HALT check** — warns when `.text` section lacks termination
- **Unresolved label references** — flags jumps/calls to undefined labels
- **Invalid directives** — catches unknown assembly directives

### Hover Information
- **Opcode hover** — name, hex code, format, encoding size, operand types, flags affected, detailed description
- **Register hover** — type (int/float/SIMD), width, index, description
- **Directive hover** — syntax, description, detailed documentation
- **Label hover** — definition location, reference count, referencing instructions

### Autocomplete
- **Opcode mnemonics** — with snippet-based operand placeholders and tab stops
- **Register names** — R0–R15 (int), F0–F15 (float), V0–V15 (SIMD)
- **Directives** — `.byte`, `.word`, `.org`, `.text`, `.data`, and 12 more
- **Label references** — labels defined in current document
- **Context-aware** — different completions at line start vs. operand position

### Go-to-Definition
- **Label references → definitions** — jump from usage to label definition
- **Cross-file resolution** — workspace-wide label index for multi-file projects
- **Label definitions** — click on label def to see its location

### Document Symbols
- **Labels** — listed as navigable symbols
- **Sections** — `.text`, `.data`, `.bss` sections

---

## FLUX ISA Overview

The FLUX ISA v1.0/v3.0 is a 256-slot instruction set featuring:

| Property | Value |
|----------|-------|
| Encoding | Variable-length (1–5 bytes), little-endian |
| Register File | 64 registers: R0–R15 (int32), F0–F15 (float), V0–V15 (128-bit SIMD) |
| Formats | A(1B), B(2B), C(3B), D(4B+i16), E(4B 3-reg), G(variable) |
| Arithmetic | Three-operand: `OP rd, rs, rt` |

### Opcode Groups

| Range | Group | Examples |
|-------|-------|---------|
| 0x00–0x07 | Control | NOP, MOV, LOAD, STORE, JMP, JZ, JNZ, CALL |
| 0x08–0x0F | Integer Arith | IADD, ISUB, IMUL, IDIV, IMOD, INEG, INC, DEC |
| 0x10–0x17 | Bitwise | IAND, IOR, IXOR, INOT, ISHL, ISHR, ROTL, ROTR |
| 0x18–0x1F | Compare | ICMP, IEQ, ILT, ILE, IGT, IGE, TEST, SETCC |
| 0x20–0x27 | Stack | PUSH, POP, DUP, SWAP, ROT, ENTER, LEAVE, ALLOCA |
| 0x28–0x2F | Function | RET, CALL_IND, TAILCALL, MOVI, IREM, CMP, JE, JNE |
| 0x30–0x37 | Memory | REGION_CREATE/DESTROY/TRANSFER, MEMCOPY/SET/CMP |
| 0x38–0x3F | Type | CAST, BOX, UNBOX, CHECK_TYPE, CHECK_BOUNDS |
| 0x40–0x4F | Float/SIMD | FADD..FGE, VLOAD/VSTORE/VADD/VSUB/VMUL/VDIV/VFMA |
| 0x60–0x6F | A2A | TELL, ASK, DELEGATE, BROADCAST, TRUST, CAP, BARRIER |
| 0x70–0x7B | Viewpoint | Babel multilingual perspective operations |
| 0x80–0x89 | System | HALT, YIELD, RESOURCE_ACQUIRE/RELEASE, DEBUG_BREAK |
| 0xA0–0xB2 | Confidence | C_IADD, C_ISUB, C_IMUL, C_MOV, C_TELL, C_ASK, ... |
| 0xC0–0xEF | Extended | MOVI32, LOAD8/16, STORE8/16, CLZ, CTZ, POPCNT |
| 0xF0–0xFF | Special | CLI, STI, HCF, RDTSC, MFENCE, LFENCE, SFENCE |

---

## .fluxasm File Format

```fluxasm
; Euclidean GCD — FLUX ISA
.text
    MOV R0, 48      ; a = 48
    MOV R1, 18      ; b = 18
loop:
    ICMP R0, R1     ; compare a, b
    JE done          ; if equal, done
    IGT R0, R1      ; a > b?
    JZ swap         ; if not, swap
    ISUB R0, R1     ; a = a - b
    JMP loop
swap:
    ISUB R1, R0     ; b = b - a
    JMP loop
done:
    HALT
```

### Syntax Elements

- **Comments**: `;` to end of line
- **Labels**: identifier followed by `:`
- **Directives**: `.text`, `.data`, `.byte`, `.word`, `.org`, etc.
- **Instructions**: `MNEMONIC operand, operand, ...`
- **Registers**: `R0`–`R15` (int), `F0`–`F15` (float), `V0`–`V15` (SIMD)
- **Immediates**: decimal (`42`), hex (`0xFF`), binary (`0b1010`)

---

## Installation

### Building from Source

```bash
cd phase1/T-006-flux-lsp
npm install
npm run build
```

### VS Code Extension

1. Copy the `client/` directory into your VS Code extension project
2. Add the FLUX language contribution point to your `package.json`:

```json
{
  "contributes": {
    "languages": [{
      "id": "fluxasm",
      "extensions": [".fluxasm"],
      "aliases": ["FLUX Assembly", "fluxasm"]
    }],
    "configuration": {
      "type": "object",
      "title": "FLUX LSP",
      "properties": {
        "fluxLsp.maxNumberOfProblems": {
          "type": "number",
          "default": 100,
          "description": "Maximum number of diagnostics"
        }
      }
    }
  }
}
```

### Running the Server Standalone

```bash
node dist/server.js --stdio
```

---

## Architecture

```
┌─────────────────────────────────────┐
│         VS Code Extension           │
│         (client/extension.ts)       │
│  ┌───────────────────────────────┐  │
│  │  LanguageClient (LSP client)  │  │
│  └──────────┬────────────────────┘  │
└─────────────┼───────────────────────┘
              │ stdio / ipc
┌─────────────┼───────────────────────┐
│  FLUX LSP Server                    │
│  (src/server.ts)                    │
│  ┌──────────────────────────────┐   │
│  │  Document Manager            │   │
│  │  ┌──────────────────────┐    │   │
│  │  │  parser.ts           │    │   │
│  │  │  ├─ Tokenizer        │    │   │
│  │  │  ├─ AST Builder      │    │   │
│  │  │  └─ Position Helpers │    │   │
│  │  └──────────┬───────────┘    │   │
│  │             │                │   │
│  │  ┌──────────┴───────────┐    │   │
│  │  │  opcode_db.ts        │    │   │
│  │  │  (247+ opcodes)      │    │   │
│  │  └──────────┬───────────┘    │   │
│  │             │                │   │
│  │  ┌─────────┴────────────┐    │   │
│  │  │ Feature Providers    │    │   │
│  │  │ ├─ diagnostics.ts    │    │   │
│  │  │ ├─ hover.ts          │    │   │
│  │  │ ├─ completion.ts     │    │   │
│  │  │ └─ definition.ts     │    │   │
│  │  └─────────────────────-┘    │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Module Responsibilities

| Module | Responsibility |
|--------|---------------|
| `server.ts` | LSP connection, document lifecycle, request routing |
| `parser.ts` | Tokenization, AST construction, position mapping |
| `opcode_db.ts` | Complete FLUX ISA opcode/register/directive database |
| `diagnostics.ts` | Syntax validation, semantic checking, error reporting |
| `hover.ts` | Context-sensitive hover documentation |
| `completion.ts` | Autocomplete with snippets and context detection |
| `definition.ts` | Go-to-definition, workspace index, symbol extraction |

---

## Diagnostic Codes

| Code | Description |
|------|-------------|
| `flux-001` | Unknown opcode |
| `flux-002` | Invalid register (out of range) |
| `flux-003` | Wrong operand count |
| `flux-004` | Duplicate label definition |
| `flux-005` | Unresolved label reference |
| `flux-006` | Missing HALT instruction |
| `flux-007` | Invalid directive |
| `flux-008` | Invalid immediate value |
| `flux-009` | Wrong operand type |
| `flux-010` | Operand value out of range |
| `flux-011` | Section after code |

---

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Watch for changes
npm run watch

# Type-check only
npm run lint

# Run server
npm run server
```

---

## Fleet Context

- **Instance**: SuperInstance/Cocapn
- **Task**: T-006 — FLUX LSP Implementation
- **ISA**: FLUX v1.0/v3.0
- **Capabilities**: diagnostics, hover, completion, definition, document-symbol
- **Opcode Coverage**: 247+ opcodes across 14 categories
- **Register Support**: R0–R15, F0–F15, V0–V15 (48 named + validation)
- **Directive Support**: 18 assembly directives

---

## License

Internal — SuperInstance/Cocapn Fleet
