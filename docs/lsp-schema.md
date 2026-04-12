# FLUX LSP Schema — Language Server Protocol Specification for FLUX

This document defines the complete LSP schema for the FLUX assembly language,
covering file types, grammar validation, autocomplete, hover, go-to-definition,
and diagnostics.

## 1. Supported File Types

| Extension | Language ID | Description |
|-----------|-------------|-------------|
| `.flux.md` | `flux.md` | FLUX Markdown — literate programming format |
| `.flux` | `flux` | Plain FLUX assembly |
| `.s.flux` | `flux` | FLUX assembly (alternative extension) |
| `.fluxasm` | `flux` | FLUX assembly (explicit assembly extension) |

## 2. .fluxasm File Grammar

`.fluxasm` files contain raw FLUX assembly without markdown wrapping.

### 2.1 Line Types

| Type | Syntax | Example |
|------|--------|---------|
| Label definition | `@name:` | `@loop:` |
| Instruction | `MNEMONIC operands ; comment` | `ADD R0, R1, R2` |
| Label + instruction | `@name: MNEMONIC operands` | `@entry: MOVI R0, 1` |
| Assembler directive | `.directive operands` | `.global main` |
| Comment (semicolon) | `; text` | `; this is a comment` |
| Comment (hash) | `# text` | `# also a comment` |
| Empty | *(whitespace)* | |

### 2.2 Register Grammar

```
register ::= gp_register | fp_register | vec_register | special_register
gp_register    ::= "R" [0-9] | "R1" [0-5]
fp_register    ::= "F" [0-9] | "F1" [0-5]
vec_register   ::= "V" [0-9] | "V1" [0-5]
special_register ::= "SP" | "FP" | "LR" | "PC" | "FLAGS"
```

### 2.3 Immediate Grammar

```
immediate ::= decimal | hexadecimal | binary | signed
decimal   ::= [+-]? [0-9]+
hexadecimal ::= "0x" [0-9a-fA-F]+ | "0X" [0-9a-fA-F]+
binary    ::= "0b" [01]+ | "0B" [01]+
```

### 2.4 Label Reference Grammar

```
label_ref ::= "@" identifier
identifier ::= [a-zA-Z_][a-zA-Z0-9_]*
```

### 2.5 Instruction Format

```
instruction ::= [label_def] mnemonic [operand_list] [comment]
label_def  ::= "@" identifier ":"
mnemonic   ::= [A-Z][A-Z0-9_]*
operand_list ::= operand ("," operand)*
operand    ::= register | immediate | label_ref | "-" | string_literal
string_literal ::= '"' [^"]* '"'
comment    ::= ";" [^\n]* | "#" [^\n]*
```

## 3. Autocomplete Triggers

### 3.1 Trigger Characters

| Character | Context | Action |
|-----------|---------|--------|
| `.` | Anywhere | Show assembler directives (`.text`, `.data`, etc.) |
| `@` | Anywhere | Show label completions (`@loop`, `@start`, etc.) |
| ` ` (space) | After mnemonic | Show register completions |
| `,` | After operand | Show register and label completions |

### 3.2 Autocomplete Items

**Opcodes** (247 items):
- All FLUX ISA opcodes from HALT (0x00) to ILLEGAL (0xFF)
- Organized by category (system, arithmetic, memory, control, etc.)
- Snippet expansion with placeholder operands
- Example: `ADD ${rd}, ${rs1}, ${rs2}`

**Registers** (53 items):
- GP registers: R0-R15 (16 items)
- FP registers: F0-F15 (16 items)
- Vector registers: V0-V15 (16 items)
- Special registers: SP, FP, LR, PC, FLAGS (5 items)

**Directives** (20 items):
- `.text`, `.data`, `.bss`, `.global`, `.extern`, `.ascii`, `.asciz`
- `.byte`, `.word`, `.half`, `.space`, `.align`, `.section`
- `.type`, `.size`, `.equ`, `.macro`, `.endm`, `.include`, `.set`

**Labels** (document-scoped):
- All `@name:` label definitions in the current document
- Shown with line number and `SymbolKind.Field`

### 3.3 Context-Aware Completion

- **Opcode position** (start of line / after label): opcodes + directives + registers + labels
- **Operand position** (after mnemonic): registers + labels
- **After `@`**: label completions only
- **After `.`**: directive completions only

## 4. Go-to-Definition Targets

### 4.1 Label References

Clicking on `@name` in operand position jumps to the `@name:` definition.

```
Reference: JMP @loop    ──→  Definition: @loop:
                                ADD R0, R0, R1
```

### 4.2 Section References

Clicking on section names in `#!import` / `#!export` directives jumps to the section definition.

```
Reference: #!import core.math  ──→  Definition: ## fn: math
```

## 5. Hover Documentation Format

### 5.1 Opcode Hover

Markdown format with:

```markdown
**MNEMONIC** (0xNN)

Description text

Format **X** — N bytes — [encoding]

Operands: `rd, rs1, rs2`
Category: `category`

*Not yet verified in conformance tests*  (if applicable)
```

### 5.2 Register Hover

```markdown
**R0**

General-purpose integer register 0.
64-bit signed integer.
```

Special registers include alias information:
```markdown
**SP** — Stack Pointer

Alias for R11. Points to the top of the call stack.
```

### 5.3 Label Hover

```markdown
**Label**: @loop

Defined at line 5
```

### 5.4 Directive Hover

```markdown
**.text**

FLUX assembler directive.
```

## 6. Diagnostic Messages

### 6.1 Error Diagnostics

| Code | Severity | Message | Trigger |
|------|----------|---------|---------|
| `flux-unknown-mnemonic` | Error | `Unknown mnemonic 'FOO'` | Unrecognized opcode name |
| `flux-invalid-register` | Error | `Expected register, got 'foo' (operand 1 of ADD)` | Non-register where register expected |
| `flux-register-range` | Error | `Register R16 out of range (valid: 0-15)` | R/F/V register number > 15 |
| `flux-undefined-label` | Error | `Undefined label '@missing'` | Reference to non-existent label |
| `flux-malformed-immediate` | Error | `Malformed immediate value '0xGZ' (operand 2 of MOVI)` | Invalid numeric literal |
| `flux-operand-count` | Error | `Expected 3 operand(s) for ADD, got 1` | Wrong number of operands |

### 6.2 Warning Diagnostics

| Code | Severity | Message | Trigger |
|------|----------|---------|---------|
| `flux-immediate-range` | Warning | `Immediate value 300 out of range for imm8 (-128 to 255)` | Immediate exceeds type range |

### 6.3 Diagnostic Source

All diagnostics use `source: 'flux-lsp'` for filtering in editor UI.

## 7. Document Symbols

Sections appear as top-level symbols in the outline view:

| Section Type | SymbolKind |
|-------------|------------|
| `## fn:` | `Function` |
| `## agent:` | `Class` |
| `## tile:` | `Module` |
| `## region:` | `Namespace` |
| `## vocabulary:` | `Property` |
| `## test:` | `Method` |

Labels within sections appear as `Field` children of their parent section.

## 8. Folding Ranges

Sections are foldable regions. Code blocks within `.flux.md` files are also foldable.

## 9. Instruction Format Reference

| Format | Size | Encoding | Example |
|--------|------|----------|---------|
| A | 1 byte | `[opcode]` | `HALT` |
| B | 2 bytes | `[opcode][reg:u8]` | `INC R2` |
| C | 2 bytes | `[opcode][imm8:u8]` | `SYS 1` |
| D | 3 bytes | `[opcode][reg:u8][imm8:i8]` | `MOVI R0, 42` |
| E | 4 bytes | `[opcode][rd:u8][rs1:u8][rs2:u8]` | `ADD R0, R1, R2` |
| F | 4 bytes | `[opcode][reg:u8][imm16:i16]` | `JMP R0, +100` |
| G | 5 bytes | `[opcode][rd:u8][rs1:u8][imm16:i16]` | `LOADOFF R0, R1, 100` |
