# flux-lsp

**Language Server Protocol implementation for FLUX.** Provides IDE features for .flux.md files across all editors.

## Features

- **Syntax Highlighting** — TextMate grammar for .flux.md (fn:, agent:, tile:, region:, import:, export:, #! directives)
- **Completion** — Opcode mnemonics, register names, vocabulary words, tile references
- **Diagnostics** — Compile errors, type errors, unreachable code warnings
- **Hover** — Opcode documentation, vocabulary descriptions, tile signatures
- **Go to Definition** — Navigate to vocabulary and tile definitions
- **Find References** — Find all uses of a vocabulary word or tile
- **Code Actions** — Quick fixes for common issues

## Architecture

```
flux-lsp/
├── src/
│   ├── server.ts          # LSP server entry point
│   ├── parser.ts          # .flux.md parser (AST)
│   ├── lexer.ts           # Tokenizer
│   ├── analyzer.ts        # Semantic analysis
│   ├── completion.ts      # Completion provider
│   ├── diagnostics.ts     # Error reporting
│   ├── hover.ts           # Hover documentation
│   ├── definition.ts      # Go to definition
│   └── grammar.json       # TextMate grammar
├── test/
│   ├── parser.test.ts
│   ├── completion.test.ts
│   └── diagnostics.test.ts
└── package.json
```

## .flux.md Grammar

```markdown
---
title: My Module
version: 1.0
tiles: [math, strings]
---

## fn: factorial(n: i32) -> i32
Computes the factorial of n.

\`\`\`flux
if n <= 1 then return 1
return n * factorial(n - 1)
\`\`\`

## agent: calculator
A calculator agent.

#!capability arithmetic
#!capability statistics

## tile: math
Math operations tile.

## region: workspace
Workspace memory region (4096 bytes).
```

## Editor Integration

- **VS Code** — Extension loading flux-lsp via stdio
- **Neovim** — nvim-lspconfig
- **Emacs** — lsp-mode
- **Helix** — Built-in LSP support

## Status

- [ ] Project scaffolding
- [ ] .flux.md lexer and parser
- [ ] TextMate grammar
- [ ] Completion provider (opcodes, registers, vocabulary)
- [ ] Diagnostics provider
- [ ] Hover provider
- [ ] Go to Definition
- [ ] VS Code extension

## Related

- [flux-spec](https://github.com/SuperInstance/flux-spec) — Language specification
- [flux-ide](https://github.com/SuperInstance/flux-ide) — Web IDE (primary consumer)
- [flux-vocabulary](https://github.com/SuperInstance/flux-vocabulary) — Vocabulary data for completion

## License

MIT
