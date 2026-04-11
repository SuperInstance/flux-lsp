# .flux.md Grammar Specification

**Version:** 1.0  
**Status:** Draft  
**Date:** 2025-07-11

---

## 1. Overview

`.flux.md` is a **markdown-native source format** for FLUX programs. It combines human-readable documentation with executable code blocks, agent directives, and type annotations in a single file. A `.flux.md` file is both a document and a program — the text you read is documentation, and the code blocks within it are compilable source that gets lowered to FLUX bytecode via the FIR (FLUX Intermediate Representation) pipeline.

### Design Goals

- **Literate programming**: Documentation and code coexist in one file
- **Polyglot support**: Code blocks can be in FLUX assembly (`flux`), FIR IR (`fir`), C (`c`), Python (`python`), or other languages
- **Agent-first**: Multi-agent coordination primitives are first-class syntax
- **IDE-friendly**: Structure enables full Language Server Protocol features (completion, hover, diagnostics, go-to-definition)

### File Extension

`.flux.md` — recognized by the LSP as language ID `flux.md`.

---

## 2. File Structure

A `.flux.md` file consists of four structural layers:

```
┌──────────────────────────────────────────────┐
│  YAML Frontmatter (optional)                 │
│  ─────────────────────────────────────────── │
│  title, version, tiles, dependencies...      │
├──────────────────────────────────────────────┤
│  Markdown Body                               │
│  ─────────────────────────────────────────── │
│  # Headings (section definitions)            │
│  ## fn:, ## agent:, ## tile:, ## region:...  │
│  Paragraphs, lists, tables                   │
│  Directive comments (#!capability, etc.)     │
│  Code blocks (```flux ... ```)               │
└──────────────────────────────────────────────┘
```

### 2.1 YAML Frontmatter

Optional block at the very top of the file, delimited by `---` lines.

```yaml
---
title: My FLUX Module
version: 1.0
description: A module that does X
tiles: [math, strings, io]
dependencies: [core, collections]
author: Agent Name
---
```

#### BNF Grammar

```
frontmatter    ::= "---" EOL frontmatter_body "---" EOL
frontmatter_body ::= (field EOL)*
field          ::= identifier ":" value
identifier     ::= [a-zA-Z_][a-zA-Z0-9_-]*
value          ::= string | number | boolean | list
string         ::= bare-word | quoted-string
bare-word      ::= [^,\[\]#\n]+
quoted-string  ::= '"' [^"]* '"'
number         ::= integer | float
integer        ::= ["-"] DIGIT+
float          ::= ["-"] DIGIT+ "." DIGIT+
boolean        ::= "true" | "false" | "yes" | "no"
list           ::= "[" item ("," item)* "]"
item           ::= string | number
```

#### Recognized Frontmatter Fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Module title |
| `version` | string/number | Module version (semver recommended) |
| `description` | string | Human-readable module description |
| `tiles` | list | Tile dependencies required by this module |
| `dependencies` | list | Module dependencies |
| `author` | string | Author or agent name |
| `license` | string | License identifier |
| `capabilities` | list | Capabilities required by this module |

### 2.2 Section Headers as Definitions

Markdown headings at level 2 (`##`) serve as **definition blocks** for FLUX constructs. The heading text uses a `keyword: name` syntax.

```
## fn: factorial(n: i32) -> i32
## agent: calculator
## tile: math
## region: workspace
## vocabulary: core_actions
## test: factorial_test
```

#### BNF Grammar

```
section_heading ::= "##" WHITESPACE section_type [":" WHITESPACE section_body] EOL
section_type    ::= "fn" | "agent" | "tile" | "region" | "vocabulary" | "test"
section_body    ::= identifier | function_signature | identifier_list
```

The body of a section (everything until the next `##` heading of the same or higher level) contains:
- Paragraph text (documentation)
- Code blocks (executable source)
- Lists (metadata, parameters)
- Directive comments (`#!...`)

### 2.3 Code Blocks

Fenced code blocks using standard markdown triple-backtick syntax. The language tag determines how the content is processed.

````markdown
```flux
MOVI R0, 42
HALT
```

```fir
function add(a: i32, b: i32) -> i32 {
  entry:
    %result = iadd a, b
    ret %result
}
```

```c
int add(int a, int b) { return a + b; }
```

```python
def add(a, b): return a + b
```
````

#### BNF Grammar

```
code_block     ::= fence_open EOL code_body EOL fence_close
fence_open     ::= "```" lang_tag [WHITESPACE meta]
fence_close    ::= "```" EOL
lang_tag       ::= "flux" | "fir" | "fluxvocab" | "c" | "python"
                | "json" | "yaml" | "toml" | "bash"
                | identifier
meta           ::= [^\n]*        ; everything after the language tag
code_body      ::= *(ANY_TEXT)   ; raw content until closing fence
```

#### Language Tag Classification

| Language Tag | Classification | Processing |
|-------------|----------------|------------|
| `flux`, `fluxfn`, `flux-type` | **FLUX Code** | Compiled to bytecode directly |
| `fir` | **FIR IR** | Passed through to FIR pipeline |
| `fluxvocab` | **Vocabulary** | Parsed as vocabulary definitions |
| `json`, `yaml`, `toml`, `yml` | **Data Block** | Parsed as structured data |
| `c`, `python`, `rust`, etc. | **Native Block** | Compiled through respective frontend |
| any other | **Native Block** | Passed through without compilation |

### 2.4 Directive Comments

Lines starting with `#!` are **directives** — instructions to the compiler and tooling. They appear at the top level (not inside code blocks) or within section bodies.

```markdown
#!capability arithmetic
#!capability network
#!import core.math
#!export factorial
#!deprecated Use new_factorial instead
#!experimental simd-path
```

#### BNF Grammar

```
directive      ::= "#!" directive_key [WHITESPACE directive_value] EOL
directive_key  ::= "capability" | "import" | "export" | "deprecated"
                | "experimental" | "require" | "feature" | "optimize"
                | "unsafe" | "test" | "bench" | identifier
directive_value ::= any_text
```

---

## 3. Section Types

### 3.1 `## fn:` — Function Definition

Defines a FLUX function with an optional type signature.

#### BNF Grammar

```
fn_section     ::= "##" WHITESPACE "fn" ":" WHITESPACE fn_signature EOL fn_body
fn_signature   ::= fn_name ["(" param_list ")"] ["->" WHITESPACE type_expr]
fn_name        ::= identifier
param_list     ::= param ("," WHITESPACE param)*
param          ::= identifier ":" WHITESPACE type_expr
type_expr      ::= primitive_type | composite_type | named_type
primitive_type ::= "i8" | "i16" | "i32" | "i64" | "f32" | "f64"
                | "bool" | "void" | "u8" | "u16" | "u32" | "u64"
composite_type ::= array_type | tuple_type | agent_type | tile_type
array_type     ::= "[" type_expr ";" integer "]"
tuple_type     ::= "(" type_expr ("," WHITESPACE type_expr)+ ")"
agent_type     ::= "agent" WHITESPACE identifier
tile_type      ::= "tile" WHITESPACE identifier
named_type     ::= identifier ["." identifier]
```

#### Examples

Simple function:
```markdown
## fn: greet
Prints a greeting message.

```flux
MOVI R0, 1
SYS 0x01
```
```

Typed function:
```markdown
## fn: factorial(n: i32) -> i32
Computes the factorial of n recursively.

```flux
; R0 = n (argument), R1 = accumulator
MOVI R1, 1        ; acc = 1

@loop:
CMP R0, 1         ; compare n with 1
JLE R0, @exit     ; if n <= 1, goto exit
IMUL R1, R1, R0   ; acc = acc * n
DEC R0            ; n--
JMP @loop         ; repeat

@exit:
MOV R0, R1        ; return acc
RET
```
```

Multiple parameters:
```markdown
## fn: cross_product(a: Vec4, b: Vec4) -> Vec4
Computes the cross product of two 4D vectors.

```flux
; Uses SIMD vector registers
VLOAD V0, R0, R1  ; load a into V0
VLOAD V1, R2, R3  ; load b into V1
; ... cross product computation
```
```

Flags:
```markdown
## fn: hot_path, vectorize
Optimized inner loop with SIMD and hot-path flags.

```flux
VFMA V0, V1, V2   ; fused multiply-add
VSTORE V0, R4, R5
```
```

### 3.2 `## agent:` — Agent Definition

Defines an autonomous agent with capabilities and behaviors.

#### BNF Grammar

```
agent_section  ::= "##" WHITESPACE "agent" ":" WHITESPACE agent_name ["," WHITESPACE flag_list] EOL agent_body
agent_name     ::= identifier
flag_list      ::= flag ("," WHITESPACE flag)*
flag           ::= identifier
agent_body     ::= *(directive | paragraph | code_block | list_block)
```

#### Examples

Basic agent:
```markdown
## agent: calculator
A calculator agent that performs arithmetic operations.

#!capability arithmetic
#!capability statistics

```flux
@main:
  ; Wait for incoming messages
  AWAIT R0, R1, R2   ; wait for signal on channel R1
  ; Process and respond
  TELL R3, R0, R4    ; send response back
  JMP @main
```
```

Agent with flags:
```markdown
## agent: orchestrator, hot-path, vectorize
High-priority orchestration agent.

#!capability delegate
#!capability monitor
#!export orchestrate
```

### 3.3 `## tile:` — Tile Definition

Defines a reusable computation tile. Tiles are composable, parameterizable computation patterns.

#### BNF Grammar

```
tile_section   ::= "##" WHITESPACE "tile" ":" WHITESPACE tile_name [WHITESPACE tile_annotation] EOL tile_body
tile_name      ::= identifier
tile_annotation ::= "(" param_list ")" ["->" WHITESPACE type_expr]
                  | ":" WHITESPACE tile_type_tag
tile_type_tag  ::= "compute" | "memory" | "control" | "a2a" | "effect" | "transform"
tile_body      ::= *(directive | paragraph | code_block | list_block)
```

#### Examples

```markdown
## tile: map_reduce
A generic map-reduce tile for parallel computation.

- **Type**: compute
- **Inputs**: data, map_fn, reduce_fn
- **Outputs**: result

```flux
; Map phase
VLOAD V0, R0, R1    ; load data chunk
VMUL  V2, V0, V3    ; apply map function
; Reduce phase
VREDUCE R4, V2, R5  ; reduce to scalar
```
```

```markdown
## tile: matmul (M: i32, N: i32, K: i32) -> f32
Matrix multiplication tile for neural network inference.

```fir
function matmul(A: [f32; M*K], B: [f32; K*N]) -> [f32; M*N] {
  entry:
    %C = malloc M * N * 4
    ; ... tiled matmul loops
    ret %C
}
```
```

### 3.4 `## region:` — Memory Region Definition

Defines a named memory region with size and access properties.

#### BNF Grammar

```
region_section ::= "##" WHITESPACE "region" ":" WHITESPACE region_name EOL region_body
region_name    ::= identifier
region_body    ::= *(directive | paragraph | code_block | list_block)
```

#### Examples

```markdown
## region: workspace
Workspace memory region (4096 bytes) for intermediate computation results.

- **Size**: 4096 bytes
- **Access**: read/write
- **Permission**: MEMORY_ALLOC

```flux
REGION_CREATE R0, 4096   ; allocate 4096-byte region
MOV R1, R0               ; store base address in R1
```
```

```markdown
## region: io_buffer
Shared I/O buffer for agent communication.

- **Size**: 1024 bytes
- **Access**: read/write/shared
- **Backing**: DMA-capable

```flux
MMIO_W R0, R1, 0x100    ; write to MMIO region
DMA_CPY R2, R3, 1024    ; DMA copy 1024 bytes
```
```

### 3.5 `## vocabulary:` — Vocabulary Definition

Defines a vocabulary of named operations/words that map to FLUX bytecode sequences.

#### BNF Grammar

```
vocab_section  ::= "##" WHITESPACE "vocabulary" ":" WHITESPACE vocab_name EOL vocab_body
vocab_name     ::= identifier
vocab_body     ::= *(directive | paragraph | vocab_code_block | list_block)
vocab_code_block ::= "```fluxvocab" EOL vocab_entry* "```" EOL
vocab_entry    ::= vocab_word WHITESPACE [vocab_params] EOL vocab_def
vocab_word     ::= ":" identifier
vocab_params   ::= "(" param_list ")"
vocab_def      ::= *(instruction_line EOL)
```

#### Examples

```markdown
## vocabulary: core_actions
Core vocabulary words for basic operations.

```fluxvocab
:double ( n -- 2n )
  ADD R0, R0, R0
  RET

:swap ( a b -- b a )
  MOV R2, R0
  MOV R0, R1
  MOV R1, R2
  RET

:negate ( n -- -n )
  NEG R0
  RET
```
```

### 3.6 `## test:` — Test Definition

Defines a test case for verification.

#### BNF Grammar

```
test_section   ::= "##" WHITESPACE "test" ":" WHITESPACE test_name EOL test_body
test_name      ::= identifier
test_body      ::= *(directive | paragraph | code_block | list_block)
```

#### Examples

```markdown
## test: factorial_test
Verify that factorial(5) = 120.

```flux
MOVI R0, 5           ; input: n = 5
CALL factorial       ; call factorial function
MOVI R1, 120         ; expected result
CMP_EQ R2, R0, R1    ; R2 = (R0 == R1)
ASSERT               ; halt if R2 != 1
```
```

---

## 4. Directive Syntax

Directives are single-line instructions prefixed with `#!`. They control compilation, visibility, and tooling behavior.

### 4.1 `#!capability` — Declare Capability

Declares that the containing module or section requires a specific capability.

```markdown
#!capability arithmetic
#!capability network
#!capability io_sensor
#!capability a2a_tell
```

Capabilities correspond to `Permission` bitflags in the runtime security model:
`READ`, `WRITE`, `EXECUTE`, `ADMIN`, `NETWORK`, `MEMORY_ALLOC`, `IO_SENSOR`, `IO_ACTUATOR`, `A2A_TELL`, `A2A_ASK`, `A2A_DELEGATE`.

### 4.2 `#!import` — Import Module

Imports a module or specific symbol from another module.

```markdown
#!import core.math
#!import collections.list
#!import tile:matmul
#!import agent:orchestrator
```

### 4.3 `#!export` — Export Symbol

Declares a symbol as publicly visible to other modules.

```markdown
#!export factorial
#!export tile:map_reduce
#!export agent:calculator
#!export vocabulary:core_actions
```

### 4.4 `#!deprecated` — Deprecation Notice

Marks a section or symbol as deprecated.

```markdown
#!deprecated Use new_factorial instead (since v2.0)
#!deprecated Will be removed in v3.0 — migrate to tile:matmul_v2
```

### 4.5 Other Directives

| Directive | Description |
|-----------|-------------|
| `#!experimental name` | Marks a feature as experimental |
| `#!require version` | Specifies minimum runtime version |
| `#!feature name` | Enables a compiler feature flag |
| `#!optimize level` | Sets optimization level (0-3) |
| `#!unsafe` | Marks a section as using unsafe operations |
| `#!test` | Marks a section as test-only |
| `#!bench` | Marks a section as a benchmark |

---

## 5. Code Block Dialects

### 5.1 ` ```flux ` — FLUX Bytecode Assembly

The primary executable code dialect. Contains FLUX assembly mnemonics that map directly to bytecode opcodes.

```flux
; Register allocation
;   R0 = accumulator, R1 = counter, R2 = limit

@start:
  MOVI R0, 0         ; acc = 0
  MOVI R1, 0         ; i = 0
  MOVI R2, 10        ; n = 10

@loop:
  ADD R0, R0, R1     ; acc += i
  INC R1             ; i++
  CMP R1, R2         ; compare i vs n
  JLT R1, @loop      ; if i < n, goto loop

  HALT               ; done
```

### 5.2 ` ```fir ` — FIR Intermediate Representation

The intermediate representation used in the FLUX compilation pipeline. SSA-form with typed values.

```fir
function fibonacci(n: i32) -> i32 {
  entry:
    %a = alloca i32
    %b = alloca i32
    %i = alloca i32
    store %a, 0
    store %b, 1
    store %i, 0
    jump %while_header

  while_header:
    %i_val = load %i
    %cmp = ilt %i_val, n
    branch %cmp, %while_body, %while_exit

  while_body:
    %a_val = load %a
    %b_val = load %b
    %temp = iadd %a_val, %b_val
    store %a, %b_val
    store %b, %temp
    %i_new = iadd %i_val, 1
    store %i, %i_new
    jump %while_header

  while_exit:
    %result = load %a
    ret %result
}
```

### 5.3 ` ```fluxvocab ` — Vocabulary Definitions

Defines vocabulary words (named instruction sequences) for the FLUX vocabulary system.

```fluxvocab
:dup
  PUSH R0
  RET

:over ( a b -- a b a )
  ; push a copy of the second element
  MOV R3, R1
  PUSH R3
  RET

:+ ( a b -- a+b )
  ADD R0, R1, R0
  POP R1
  RET
```

---

## 6. Expression Grammar (Inside `flux` Code Blocks)

This section defines the grammar for FLUX assembly within ` ```flux ` code blocks.

### 6.1 Labels

Labels mark positions in code for jump targets. They start with `@` and end with `:`.

```
label ::= "@" label_name ":"
label_name ::= identifier
identifier ::= [a-zA-Z_][a-zA-Z0-9_]*
```

Examples:
```flux
@start:
@loop:
@error_handler:
@exit_condition:
```

### 6.2 Instructions

An instruction line consists of an opcode mnemonic followed by zero or more operands.

```
instruction_line ::= [label] [mnemonic [operand_list]] [comment]
mnemonic ::= MNEMONIC_NAME   ; see full list in Section 6.6
operand_list ::= operand ("," WHITESPACE operand)*
operand ::= register | immediate | label_ref | "-"  ; "-" for unused operand
register ::= gp_register | fp_register | vec_register | special_register
label_ref ::= "@" label_name
comment ::= ";" [^\n]*
```

### 6.3 Register Names

```
gp_register     ::= "R" DIGIT     ; R0-R15
fp_register     ::= "F" DIGIT     ; F0-F15
vec_register    ::= "V" DIGIT     ; V0-V15
special_register ::= "SP" | "FP" | "LR" | "PC" | "FLAGS"
```

| Register | Alias | Purpose |
|----------|-------|---------|
| R0–R10 | — | General-purpose integer |
| R11 | SP | Stack pointer |
| R12 | — | General-purpose integer |
| R13 | — | General-purpose integer |
| R14 | FP | Frame pointer |
| R15 | LR | Link register (return address) |
| F0–F15 | — | Floating-point |
| V0–V15 | — | SIMD vector |
| PC | — | Program counter (read-only in most contexts) |
| FLAGS | — | Status flags (Z, S, C, V) |

### 6.4 Immediates

Numeric constants embedded directly in instructions.

```
immediate    ::= decimal | hexadecimal | binary | signed_offset
decimal      ::= ["+" | "-"] DIGIT+
hexadecimal  ::= "0x" HEX_DIGIT+ | "0X" HEX_DIGIT+
binary       ::= "0b" BIN_DIGIT+ | "0B" BIN_DIGIT+
signed_offset ::= ("+" | "-") DIGIT+
DIGIT        ::= [0-9]
HEX_DIGIT    ::= [0-9a-fA-F]
BIN_DIGIT    ::= [01]
```

Examples:
```flux
MOVI R0, 42        ; decimal
MOVI R1, 0xFF      ; hexadecimal
MOVI R2, 0b101010  ; binary
JMP +20            ; positive offset
JMP -16            ; negative offset
ADDI R0, -5        ; negative immediate
```

### 6.5 String Literals

String literals appear in specific instructions (SYS, TELL, ASK, etc.) for message passing and system calls.

```
string_literal ::= '"' string_char* '"'
string_char    ::= ESCAPE | [^"\\]
ESCAPE        ::= "\\n" | "\\t" | "\\r" | "\\0" | "\\\\" | '\\"'
```

Examples:
```flux
; System call with string argument
SYS "hello world"

; Agent communication
TELL R0, R1, "status_update"
```

### 6.6 Comments

Two comment styles inside `flux` code blocks:

```
line_comment     ::= ";" [^\n]*
hash_comment     ::= "#" [^\n]*
```

The semicolon (`;`) is the preferred comment character. The hash (`#`) is also supported for compatibility.

Examples:
```flux
; This is a comment
MOVI R0, 42    ; inline comment
# This is also a comment
```

### 6.7 Full Opcode Mnemonic List

The following is the complete set of FLUX instruction mnemonics, organized by opcode range. Each mnemonic maps to a bytecode opcode in the unified ISA.

#### System Control (0x00–0x07)
`HALT`, `NOP`, `RET`, `IRET`, `BRK`, `WFI`, `RESET`, `SYN`

#### Single Register (0x08–0x0F)
`INC`, `DEC`, `NOT`, `NEG`, `PUSH`, `POP`, `CONF_LD`, `CONF_ST`

#### Immediate Only (0x10–0x17)
`SYS`, `TRAP`, `DBG`, `CLF`, `SEMA`, `YIELD`, `CACHE`, `STRIPCF`

#### Register + Imm8 (0x18–0x1F)
`MOVI`, `ADDI`, `SUBI`, `ANDI`, `ORI`, `XORI`, `SHLI`, `SHRI`

#### Integer Arithmetic (0x20–0x2F)
`ADD`, `SUB`, `MUL`, `DIV`, `MOD`, `AND`, `OR`, `XOR`, `SHL`, `SHR`, `MIN`, `MAX`, `CMP_EQ`, `CMP_LT`, `CMP_GT`, `CMP_NE`

#### Float, Memory, Control (0x30–0x3F)
`FADD`, `FSUB`, `FMUL`, `FDIV`, `FMIN`, `FMAX`, `FTOI`, `ITOF`, `LOAD`, `STORE`, `MOV`, `SWP`, `JZ`, `JNZ`, `JLT`, `JGT`

#### Register + Imm16 (0x40–0x47)
`MOVI16`, `ADDI16`, `SUBI16`, `JMP`, `JAL`, `CALL`, `LOOP`, `SELECT`

#### Register + Register + Imm16 (0x48–0x4F)
`LOADOFF`, `STOREOF`, `LOADI`, `STOREI`, `ENTER`, `LEAVE`, `COPY`, `FILL`

#### Agent-to-Agent (0x50–0x5F)
`TELL`, `ASK`, `DELEG`, `BCAST`, `ACCEPT`, `DECLINE`, `REPORT`, `MERGE`, `FORK`, `JOIN`, `SIGNAL`, `AWAIT`, `TRUST`, `DISCOV`, `STATUS`, `HEARTBT`

#### Confidence-Aware (0x60–0x6F)
`C_ADD`, `C_SUB`, `C_MUL`, `C_DIV`, `C_FADD`, `C_FSUB`, `C_FMUL`, `C_FDIV`, `C_MERGE`, `C_THRESH`, `C_BOOST`, `C_DECAY`, `C_SOURCE`, `C_CALIB`, `C_EXPLY`, `C_VOTE`

#### Viewpoint Operations (0x70–0x7F)
`V_EVID`, `V_EPIST`, `V_MIR`, `V_NEG`, `V_TENSE`, `V_ASPEC`, `V_MODAL`, `V_POLIT`, `V_HONOR`, `V_TOPIC`, `V_FOCUS`, `V_CASE`, `V_AGREE`, `V_CLASS`, `V_INFL`, `V_PRAGMA`

#### Biology/Sensor (0x80–0x8F)
`SENSE`, `ACTUATE`, `SAMPLE`, `ENERGY`, `TEMP`, `GPS`, `ACCEL`, `DEPTH`, `CAMCAP`, `CAMDET`, `PWM`, `GPIO`, `I2C`, `SPI`, `UART`, `CANBUS`

#### Extended Math/Crypto (0x90–0x9F)
`ABS`, `SIGN`, `SQRT`, `POW`, `LOG2`, `CLZ`, `CTZ`, `POPCNT`, `CRC32`, `SHA256`, `RND`, `SEED`, `FMOD`, `FSQRT`, `FSIN`, `FCOS`

#### String/Collection (0xA0–0xAF)
`LEN`, `CONCAT`, `AT`, `SETAT`, `SLICE`, `REDUCE`, `MAP`, `FILTER`, `SORT`, `FIND`, `HASH`, `HMAC`, `VERIFY`, `ENCRYPT`, `DECRYPT`, `KEYGEN`

#### Vector/SIMD (0xB0–0xBF)
`VLOAD`, `VSTORE`, `VADD`, `VMUL`, `VDOT`, `VNORM`, `VSCALE`, `VMAXP`, `VMINP`, `VREDUCE`, `VGATHER`, `VSCATTER`, `VSHUF`, `VMERGE`, `VCONF`, `VSELECT`

#### Tensor/Neural (0xC0–0xCF)
`TMATMUL`, `TCONV`, `TPOOL`, `TRELU`, `TSIGM`, `TSOFT`, `TLOSS`, `TGRAD`, `TUPDATE`, `TADAM`, `TEMBED`, `TATTN`, `TSAMPLE`, `TTOKEN`, `TDETOK`, `TQUANT`

#### Extended Memory/I-O (0xD0–0xDF)
`DMA_CPY`, `DMA_SET`, `MMIO_R`, `MMIO_W`, `ATOMIC`, `CAS`, `FENCE`, `MALLOC`, `FREE`, `MPROT`, `MCACHE`, `GPU_LD`, `GPU_ST`, `GPU_EX`, `GPU_SYNC`

#### Long Jumps/Calls (0xE0–0xEF)
`JMPL`, `JALL`, `CALLL`, `TAIL`, `SWITCH`, `COYIELD`, `CORESUM`, `FAULT`, `HANDLER`, `TRACE`, `PROF_ON`, `PROF_OFF`, `WATCH`

#### Extended System/Debug (0xF0–0xFF)
`HALT_ERR`, `REBOOT`, `DUMP`, `ASSERT`, `ID`, `VER`, `CLK`, `PCLK`, `WDOG`, `SLEEP`, `ILLEGAL`

### 6.8 Instruction Formats

| Format | Size | Encoding | Example |
|--------|------|----------|---------|
| A | 1 byte | `[opcode]` | `HALT` |
| B | 2 bytes | `[opcode][reg:u8]` | `INC R2` |
| C | 2 bytes | `[opcode][imm8:u8]` | `SYS 1` |
| D | 3 bytes | `[opcode][reg:u8][imm8:i8]` | `MOVI R0, 42` |
| E | 4 bytes | `[opcode][rd:u8][rs1:u8][rs2:u8]` | `ADD R0, R1, R2` |
| F | 4 bytes | `[opcode][reg:u8][imm16:i16]` | `JMP R0, +100` |
| G | 5 bytes | `[opcode][rd:u8][rs1:u8][imm16:i16]` | `LOADOFF R0, R1, 100` |

---

## 7. Type System

### 7.1 Primitive Types

| Type | Size | Description |
|------|------|-------------|
| `i8` | 1 byte | Signed 8-bit integer |
| `i16` | 2 bytes | Signed 16-bit integer |
| `i32` | 4 bytes | Signed 32-bit integer |
| `i64` | 8 bytes | Signed 64-bit integer |
| `u8` | 1 byte | Unsigned 8-bit integer |
| `u16` | 2 bytes | Unsigned 16-bit integer |
| `u32` | 4 bytes | Unsigned 32-bit integer |
| `u64` | 8 bytes | Unsigned 64-bit integer |
| `f32` | 4 bytes | IEEE 754 single-precision float |
| `f64` | 8 bytes | IEEE 754 double-precision float |
| `bool` | 1 byte | Boolean (0 or 1) |
| `void` | 0 bytes | No value (return type only) |

### 7.2 Composite Types

#### Array Types

```
array_type ::= "[" element_type ";" size "]"
element_type ::= type_expr
size ::= integer
```

Examples:
```fir
[f32; 4]       ; array of 4 floats (Vec4)
[i32; 16]      ; array of 16 integers
[bool; 256]    ; array of 256 booleans
```

#### Tuple Types

```
tuple_type ::= "(" type_expr ("," WHITESPACE type_expr)+ ")"
```

Examples:
```fir
(i32, f32)           ; pair of int and float
(i32, f32, f32, f32) ; mixed tuple
```

### 7.3 Agent Types

```
agent_type ::= "agent" WHITESPACE identifier
```

Examples:
```fir
agent calculator       ; calculator agent type
agent orchestrator     ; orchestrator agent type
```

### 7.4 Tile Types

```
tile_type ::= "tile" WHITESPACE identifier
```

Examples:
```fir
tile matmul            ; matrix multiplication tile
tile map_reduce        ; map-reduce tile
```

### 7.5 Named Types (Structures)

```
named_type ::= identifier ["." identifier]
```

Examples:
```fir
Vec4                    ; user-defined type
core.math.Matrix       ; module-qualified type
```

### 7.6 Type Grammar Summary

```
type_expr      ::= primitive_type | composite_type | named_type
primitive_type ::= "i8" | "i16" | "i32" | "i64"
                | "u8" | "u16" | "u32" | "u64"
                | "f32" | "f64" | "bool" | "void"
composite_type ::= array_type | tuple_type | agent_type | tile_type
array_type     ::= "[" type_expr ";" integer "]"
tuple_type     ::= "(" type_expr ("," WHITESPACE type_expr)+ ")"
agent_type     ::= "agent" WHITESPACE identifier
tile_type      ::= "tile" WHITESPACE identifier
named_type     ::= identifier ["." identifier]
```

---

## 8. Semantic Rules

### 8.1 Section Ordering Constraints

Sections within a `.flux.md` file should follow this logical ordering (enforced by the compiler with warnings for violations):

1. **Frontmatter** (if present) — must be the first element
2. **`#!import` directives** — imports before usage
3. **`#!capability` directives** — capability declarations
4. **`## region:` definitions** — memory regions before functions that use them
5. **`## vocabulary:` definitions** — vocabularies before functions that call them
6. **`## tile:` definitions** — tiles before agents that use them
7. **`## fn:` definitions** — functions (may reference tiles and regions)
8. **`## agent:` definitions** — agents (top-level, reference everything above)
9. **`## test:` definitions** — tests (reference everything above)
10. **`#!export` directives** — exports (after definitions)

### 8.2 Name Resolution Scoping

```
scope_hierarchy ::=
  module_scope
    -> region_scope*
    -> vocabulary_scope*
    -> tile_scope*
    -> fn_scope*
    -> agent_scope*
    -> test_scope*
```

**Rules:**

1. **Module scope**: All `#!export`ed names are visible at the module level
2. **Import resolution**: `#!import core.math` brings `core.math.*` into scope
3. **Within-section scope**: Labels are scoped to their containing code block
4. **Register scope**: Registers are global within a code block; no nested scoping
5. **Vocabulary scope**: Vocabulary words defined in `## vocabulary:` are available to all `## fn:` sections in the same module
6. **Tile scope**: Tiles defined in `## tile:` are available to all `## agent:` and `## fn:` sections

### 8.3 Import/Export Visibility Rules

1. **Default visibility**: All `## fn:`, `## tile:`, `## agent:`, `## vocabulary:`, and `## region:` definitions are **private** (module-local) unless explicitly exported
2. **Explicit export**: `#!export name` makes `name` visible to importing modules
3. **Wildcard import**: `#!import module` imports only `#!export`ed symbols from `module`
4. **Qualified import**: `#!import module.symbol` imports a specific symbol
5. **Circular imports**: Not allowed; the compiler detects and reports circular dependencies
6. **Re-exports**: `#!export imported_name` re-exports a previously imported symbol

### 8.4 Capability Enforcement

1. Each `#!capability` directive creates a capability requirement
2. At runtime, the capability registry checks that the executing agent holds the required permission
3. Capability checks are inserted automatically before protected operations (TELL, ASK, DELEG, SENSE, ACTUATE, etc.)
4. Missing capabilities result in a runtime fault (FAULT opcode with capability error code)

### 8.5 Code Block Validation

1. **`flux` blocks**: All mnemonics must be valid opcodes; registers must be in valid range (R0–R15, F0–F15, V0–V15)
2. **`fir` blocks**: Must conform to FIR SSA form; all values must be defined before use
3. **`fluxvocab` blocks**: Each word must start with `:`; stack effect comments are recommended but not required
4. **`native` blocks** (c, python, etc.): Validated by their respective frontends

---

## 9. Complete Example

```markdown
---
title: Fibonacci Module
version: 1.0
description: Computing Fibonacci with memoization
tiles: [math]
capabilities: [arithmetic]
---

# Fibonacci Module

This module provides an efficient Fibonacci implementation using
FLUX bytecode with memoization support.

#!import core.memory
#!capability arithmetic
#!export fibonacci

## region: memo_table
Memoization table for caching computed Fibonacci values.

- **Size**: 1024 bytes
- **Access**: read/write

```flux
REGION_CREATE R0, 1024
MOV R12, R0          ; R12 = memo table base
MEMSET R0, R1, 1024  ; initialize to -1 (unused)
```

## fn: fibonacci(n: i32) -> i32
Compute the nth Fibonacci number with memoization.

```flux
; Input:  R0 = n
; Output: R0 = fibonacci(n)
; Clobbers: R1, R2, R3

  CMP_EQ R3, R0, 0     ; if n == 0
  JNZ R3, @base_zero
  CMP_EQ R3, R0, 1     ; if n == 1
  JNZ R3, @base_one

@check_memo:
  ; Check memo[n] (offset = n * 4)
  SHLI R2, R0, 2       ; R2 = n * 4
  LOADOFF R3, R12, R2   ; R3 = memo[n]
  CMP_NE R3, R3, -1    ; if memo[n] != -1 (already computed)
  JNZ R3, @memo_hit

@recurse:
  ; Save n, compute fib(n-1)
  PUSH R0
  DEC R0               ; n - 1
  CALL fibonacci
  MOV R1, R0           ; R1 = fib(n-1)
  POP R0

  ; Save fib(n-1), compute fib(n-2)
  PUSH R0
  PUSH R1
  DEC R0
  DEC R0               ; n - 2
  CALL fibonacci
  MOV R3, R0           ; R3 = fib(n-2)
  POP R1
  POP R0

  ; result = fib(n-1) + fib(n-2)
  ADD R0, R1, R3

  ; Store in memo
  SHLI R2, R0, 2
  STOREOF R0, R12, R2
  RET

@base_zero:
  MOVI R0, 0
  RET

@base_one:
  MOVI R0, 1
  RET

@memo_hit:
  MOV R0, R3
  RET
```

## agent: fib_server
Fibonacci computation server agent.

#!capability a2a_tell
#!capability a2a_ask

```flux
@main:
  AWAIT R0, R1, R2      ; wait for request
  ; R1 contains the request payload
  MOV R0, R1             ; n = payload
  CALL fibonacci         ; compute
  TELL R3, R0, R4        ; send result back
  JMP @main
```

## test: fib_test_10
Verify fibonacci(10) = 55.

```flux
MOVI R0, 10
CALL fibonacci
MOVI R1, 55
CMP_EQ R2, R0, R1
ASSERT
```

## test: fib_test_0
Verify fibonacci(0) = 0.

```flux
MOVI R0, 0
CALL fibonacci
MOVI R1, 0
CMP_EQ R2, R0, R1
ASSERT
```
```

---

## Appendix A: AST Node Types

The parser produces the following AST node types (from `flux.parser.nodes`):

| Node | Description |
|------|-------------|
| `FluxModule` | Root node; contains `frontmatter` dict and `children` list |
| `Heading` | Markdown heading (`#` through `######`) with level and text |
| `Paragraph` | Plain text paragraph |
| `CodeBlock` | Generic fenced code block (lang, content, meta) |
| `FluxCodeBlock` | Code block with `lang` in {flux, fluxfn, flux-type} |
| `DataBlock` | Code block with `lang` in {json, yaml, toml, yml} |
| `NativeBlock` | Code block in any other language |
| `ListBlock` | Ordered or unordered list of ListItem nodes |
| `ListItem` | Single list item with text and optional children |
| `AgentDirective` | Extracted `## agent:` or `## fn:` heading with args and body |
| `FluxTypeError` | Error node for type/syntax issues |
| `SourceSpan` | Line/column range for error reporting |

## Appendix B: Token Types (for LSP Lexer)

| Token | Regex | Description |
|-------|-------|-------------|
| `FRONTMATTER_OPEN` | `^---\s*$` | Frontmatter delimiter |
| `SECTION_HEADING` | `^##\s+(fn|agent|tile|region|vocabulary|test)\s*[:\s]` | Section definition |
| `DIRECTIVE` | `^#!\w+` | Compiler directive |
| `CODE_FENCE_OPEN` | `^(```{3,})(\w*)` | Code fence start |
| `CODE_FENCE_CLOSE` | `^`{3,}`\s*$` | Code fence end |
| `LABEL` | `@[a-zA-Z_]\w*:` | Assembly label |
| `MNEMONIC` | `[A-Z][A-Z0-9_]*` | Opcode mnemonic |
| `GP_REGISTER` | `R(1[0-5]|[0-9])\b` | General-purpose register |
| `FP_REGISTER` | `F(1[0-5]|[0-9])\b` | Float register |
| `VEC_REGISTER` | `V(1[0-5]|[0-9])\b` | Vector register |
| `SPECIAL_REGISTER` | `(SP|FP|LR|PC|FLAGS)\b` | Special register |
| `IMM_DECIMAL` | `[+-]?\d+` | Decimal immediate |
| `IMM_HEX` | `0[xX][0-9a-fA-F]+` | Hexadecimal immediate |
| `IMM_BINARY` | `0[bB][01]+` | Binary immediate |
| `STRING_LITERAL` | `"[^"]*"` | String literal |
| `LINE_COMMENT` | `;[^\n]*` | Semicolon comment |
| `HASH_COMMENT` | `#[^\n]*` | Hash comment |
| `TYPE_PRIMITIVE` | `(i8|i16|i32|i64|u8|u16|u32|u64|f32|f64|bool|void)\b` | Primitive type |
| `ARROW` | `->` | Return type arrow |
