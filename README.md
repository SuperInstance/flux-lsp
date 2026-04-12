# flux-lsp

**Language Server Protocol implementation for FLUX assembly.** Provides IDE features for `.flux.md` and `.flux` files across all editors.

## Features

- **Autocomplete** — All 247 FLUX opcodes organized by category, 53 registers (R0-R15, F0-F15, V0-V15, SP/FP/LR/PC/FLAGS), 20 assembler directives, and document-local labels with snippet expansion
- **Hover Documentation** — Hover over any opcode to see its description, format, encoding size, operand types, and conformance status. Hover over registers for alias information
- **Diagnostics** — Real-time validation: unknown mnemonics, invalid register numbers (R16+), undefined label references, malformed immediate values, out-of-range immediates (imm8/imm16), wrong operand counts
- **Go-to-Definition** — Ctrl+Click on a label reference (`@loop`) to jump to its definition
- **Document Symbols** — Outline view showing all sections (`## fn:`, `## agent:`, `## tile:`, etc.) and their nested labels
- **Folding** — Fold sections and code blocks in `.flux.md` files
- **Syntax Highlighting** — TextMate grammar for FLUX Markdown (fn:, agent:, tile:, #! directives, registers, immediates, comments)

## Architecture

```
flux-lsp/
├── src/
│   ├── index.ts            # Entry point — creates connection, starts server
│   ├── server.ts           # Main LSP server (completion, hover, definition, symbols)
│   ├── opcode-database.ts  # Complete opcode reference (247 opcodes from ISA_UNIFIED.md)
│   ├── parser.ts           # FLUX assembly parser (labels, opcodes, directives, sections)
│   └── diagnostics.ts      # Diagnostic provider (validation engine)
├── grammars/
│   └── flux.tmLanguage.json # TextMate grammar for syntax highlighting
├── docs/
│   └── grammar-spec.md      # Full grammar specification (1163 lines)
├── language-configuration.json
├── package.json
├── tsconfig.json
└── README.md
```

### Module Responsibilities

| Module | Lines | Purpose |
|--------|-------|---------|
| `opcode-database.ts` | ~530 | Complete FLUX ISA reference: all 247 opcodes with hex encoding, format (A-G), operand types, descriptions, categories. Generates LSP CompletionItems for opcodes, registers, directives. |
| `parser.ts` | ~230 | Parses FLUX assembly into `ParsedLine` objects. Extracts labels, sections, label references. Validates register/immediate/label-ref syntax. |
| `diagnostics.ts` | ~160 | Two-pass diagnostic engine: (1) per-line checks for unknown mnemonics, wrong operand counts, register range, immediate range; (2) undefined label references across document. |
| `server.ts` | ~490 | Main LSP server class. Handles completion (context-aware: opcode position vs operand position), hover (opcode docs, register info, labels), go-to-definition (labels, sections), document symbols (sections + nested labels), folding ranges. Filters diagnostics to flux code blocks in .flux.md. |
| `index.ts` | ~40 | Entry point. Creates stdio connection, text document manager, instantiates FluxLanguageServer. |

## Supported File Types

### `.flux.md` — FLUX Markdown (primary)
Markdown-native source format combining documentation with executable code blocks. Sections define functions, agents, tiles, regions. Code blocks (` ```flux `) contain assembly validated by the LSP.

```markdown
## fn: factorial(n: i32) -> i32

```flux
@start:
  MOVI R1, 1        ; acc = 1
@loop:
  CMP_EQ R3, R0, 1
  JNZ R3, @exit
  MUL R1, R1, R0
  DEC R0
  JMP @loop
@exit:
  MOV R0, R1
  HALT
```
```

### `.flux` — Plain FLUX Assembly
Standalone assembly files with full LSP support (diagnostics, completion, hover).

```flux
; GCD of R0 and R1
@loop:
  CMP_EQ R2, R1, 0
  JNZ R2, @done
  MOD R2, R0, R1
  MOV R0, R1
  MOV R1, R2
  JMP @loop
@done:
  HALT
```

## Building and Installing

### Prerequisites
- Node.js 18+
- npm 9+

### Build

```bash
cd flux-lsp
npm install
npm run build
```

### VS Code

1. Clone the repo and build:
   ```bash
   git clone https://github.com/SuperInstance/flux-lsp.git
   cd flux-lsp
   npm install && npm run build
   ```
2. Open in VS Code as a workspace folder
3. Press F5 to launch Extension Development Host
4. Open a `.flux.md` file to test

### Neovim

```lua
-- Using nvim-lspconfig (lazy.nvim)
require('lspconfig').flux_lsp.setup {
  cmd = { 'node', '/path/to/flux-lsp/dist/index.js' },
  filetypes = { 'flux.md', 'flux' },
  root_dir = require('lspconfig').util.root_pattern('.git', 'flux-lsp'),
}
```

### Helix

Add to `~/.config/helix/languages.toml`:

```toml
[language-server.flux-lsp]
command = "node"
args = ["/path/to/flux-lsp/dist/index.js"]

[[language]]
name = "flux"
scope = "source.flux"
file-types = ["flux", "flux.md"]
roots = []
language-servers = ["flux-lsp"]
```

### Emacs (eglot)

```elisp
(add-to-list 'eglot-server-programs
  '(("\\.flux\\.md\\'" . ("node" "/path/to/flux-lsp/dist/index.js"))))
```

## Opcode Coverage

The LSP covers all 247 defined opcodes from the FLUX Unified ISA:

| Category | Range | Count | Examples |
|----------|-------|-------|---------|
| System Control | 0x00–0x07 | 8 | HALT, NOP, RET, BRK |
| Single Register | 0x08–0x0F | 8 | INC, DEC, NOT, PUSH, POP |
| Immediate Only | 0x10–0x17 | 8 | SYS, TRAP, DBG, YIELD |
| Register + Imm8 | 0x18–0x1F | 8 | MOVI, ADDI, SUBI, SHLI |
| Integer Arithmetic | 0x20–0x2F | 16 | ADD, SUB, MUL, DIV, CMP_* |
| Float/Memory/Control | 0x30–0x3F | 16 | FADD, LOAD, STORE, MOV, JZ |
| Register + Imm16 | 0x40–0x47 | 8 | MOVI16, JMP, JAL, LOOP |
| Offset Memory | 0x48–0x4F | 8 | LOADOFF, STOREOF, COPY, FILL |
| Agent-to-Agent | 0x50–0x5F | 16 | TELL, ASK, DELEG, FORK |
| Confidence-Aware | 0x60–0x6F | 16 | C_ADD, C_SUB, C_MERGE |
| Viewpoint | 0x70–0x7F | 16 | V_EVID, V_EPIST, V_TENSE |
| Sensor | 0x80–0x8F | 16 | SENSE, GPS, PWM, GPIO |
| Math/Crypto | 0x90–0x9F | 16 | ABS, SQRT, SHA256, RND |
| String/Collection | 0xA0–0xAF | 16 | LEN, CONCAT, SORT, HASH |
| Vector/SIMD | 0xB0–0xBF | 16 | VLOAD, VADD, VDOT, VREDUCE |
| Tensor/Neural | 0xC0–0xCF | 16 | TMATMUL, TCONV, TRELU, TATTN |
| Extended Memory | 0xD0–0xDF | 15 | DMA_CPY, MMIO_R, ATOMIC, MALLOC |
| Long Jumps | 0xE0–0xEF | 12 | JMPL, CALLL, SWITCH, COYIELD |
| System/Debug | 0xF0–0xFF | 12 | HALT_ERR, ASSERT, DUMP, ILLEGAL |

## Configuration

Settings are available under `flux-lsp.*` in VS Code preferences:

| Setting | Default | Description |
|---------|---------|-------------|
| `flux-lsp.trace.server` | `off` | Trace level (off/messages/verbose) |
| `flux-lsp.maxNumberOfProblems` | `100` | Max diagnostics per file |
| `flux-lsp.diagnostics.enable` | `true` | Enable/disable validation |

## Related

- [flux-spec](https://github.com/SuperInstance/flux-spec) — Language specification
- [flux-runtime](https://github.com/SuperInstance/flux-runtime) — Runtime and ISA definition
- [flux-ide](https://github.com/SuperInstance/flux-ide) — Web IDE (primary consumer)
- [ISA_UNIFIED.md](https://github.com/SuperInstance/flux-runtime/blob/main/docs/ISA_UNIFIED.md) — Complete opcode table

## License

MIT
