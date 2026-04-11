/**
 * completion.ts — Completion provider for .flux.md files
 *
 * WHY: Developers typing in .flux.md files need autocompletion for opcodes,
 * registers, section types, directive keys, and vocabulary words. Without this,
 * they'd need to memorize 200+ mnemonics or constantly reference the ISA spec.
 * The completion provider turns the grammar-spec.md knowledge into real IDE
 * assistance.
 *
 * DECISION: Context-aware completion based on cursor position. When the cursor
 * is inside a flux code block, we suggest opcodes and registers. When it's on
 * a ## heading line, we suggest section types. When it's on a #! line, we
 * suggest directive keys. This "right thing at the right time" approach reduces
 * noise and makes completion actually useful rather than overwhelming.
 *
 * TIMESTAMP: 2026-04-12T02:30:00Z — Session 8, LSP scaffolding
 */

import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  Position,
} from 'vscode-languageserver/node';

import { OPCODES, MNEMONIC_MAP, ALL_REGISTERS, PRIMITIVE_TYPES } from './opcodes';
import { SectionType, DirectiveKey, CodeBlockDialect, FluxModule, NodeType, SectionHeadingNode } from './types';
import { DocumentManager } from './document-manager';

export class FluxCompletionProvider {
  private docManager: DocumentManager;

  constructor(docManager: DocumentManager) {
    this.docManager = docManager;
  }

  /** Get completions at a given position */
  getCompletions(uri: string, position: Position): CompletionItem[] {
    const entry = this.docManager.getDocument(uri);
    if (!entry) return [];

    const lineContent = entry.document.getText({
      start: { line: position.line, character: 0 },
      end: { line: position.line, character: position.character + 20 },
    });

    // Determine context from line content
    if (lineContent.trimStart().startsWith('##')) {
      return this.getSectionCompletions();
    }
    if (lineContent.trimStart().startsWith('#!')) {
      return this.getDirectiveCompletions();
    }

    // Check if we're inside a code block
    if (this.isInFluxCodeBlock(entry.ast, position.line)) {
      return this.getCodeBlockCompletions(lineContent, position);
    }

    // Type signature context
    if (this.isInTypeContext(entry.ast, position.line)) {
      return this.getTypeCompletions();
    }

    return this.getDefaultCompletions();
  }

  /** Completions for section headings (## fn:, ## agent:, etc.) */
  private getSectionCompletions(): CompletionItem[] {
    const sections = [
      { type: 'fn', detail: 'Function definition', doc: 'Define a FLUX function with optional type signature' },
      { type: 'agent', detail: 'Agent definition', doc: 'Define an autonomous agent with capabilities' },
      { type: 'tile', detail: 'Tile definition', doc: 'Define a reusable computation tile' },
      { type: 'region', detail: 'Memory region', doc: 'Define a named memory region' },
      { type: 'vocabulary', detail: 'Vocabulary definition', doc: 'Define a vocabulary of named operations' },
      { type: 'test', detail: 'Test definition', doc: 'Define a test case' },
    ];

    return sections.map(s => ({
      label: `${s.type}: `,
      kind: CompletionItemKind.Class,
      detail: s.detail,
      documentation: s.doc,
      insertText: `${s.type}: $1`,
      insertTextFormat: InsertTextFormat.Snippet,
    }));
  }

  /** Completions for directive keys (#!capability, #!import, etc.) */
  private getDirectiveCompletions(): CompletionItem[] {
    const directives = [
      { key: 'capability', detail: 'Declare capability', doc: 'Declare a capability required by this module' },
      { key: 'import', detail: 'Import module', doc: 'Import a module or specific symbol' },
      { key: 'export', detail: 'Export symbol', doc: 'Make a symbol visible to other modules' },
      { key: 'deprecated', detail: 'Deprecation notice', doc: 'Mark a section or symbol as deprecated' },
      { key: 'experimental', detail: 'Experimental feature', doc: 'Mark a feature as experimental' },
      { key: 'require', detail: 'Require version', doc: 'Specify minimum runtime version' },
      { key: 'feature', detail: 'Feature flag', doc: 'Enable a compiler feature flag' },
      { key: 'optimize', detail: 'Optimization level', doc: 'Set optimization level (0-3)' },
      { key: 'unsafe', detail: 'Unsafe block', doc: 'Mark a section as using unsafe operations' },
      { key: 'test', detail: 'Test marker', doc: 'Mark a section as test-only' },
      { key: 'bench', detail: 'Benchmark marker', doc: 'Mark a section as a benchmark' },
    ];

    return directives.map(d => ({
      label: `#!${d.key}`,
      kind: CompletionItemKind.Keyword,
      detail: d.detail,
      documentation: d.doc,
    }));
  }

  /** Completions inside flux code blocks */
  private getCodeBlockCompletions(lineContent: string, position: Position): CompletionItem[] {
    const completions: CompletionItem[] = [];

    // Determine what's already on the line
    const trimmed = lineContent.trim();

    // If line starts with @, it's a label
    if (trimmed.startsWith('@') && !trimmed.includes(':')) {
      return completions; // Labels are user-defined, can't complete
    }

    // If line has a mnemonic already, complete operands
    const mnemonicMatch = trimmed.match(/^(@?[a-zA-Z_]\w*:)?\s*([A-Z][A-Z0-9_]*)/);
    if (mnemonicMatch && position.character > trimmed.indexOf(mnemonicMatch[2]) + mnemonicMatch[2].length) {
      // After mnemonic — complete operands (registers + labels)
      completions.push(...this.getRegisterCompletions());
      return completions;
    }

    // Default: complete mnemonics
    completions.push(...this.getMnemonicCompletions());
    completions.push(...this.getRegisterCompletions());

    return completions;
  }

  /** Opcode mnemonic completions */
  private getMnemonicCompletions(): CompletionItem[] {
    return OPCODES.map(op => ({
      label: op.mnemonic,
      kind: CompletionItemKind.Function,
      detail: `0x${op.opcode.toString(16).padStart(2, '0')} ${op.format}`,
      documentation: op.description,
      insertText: this.buildInstructionSnippet(op),
      insertTextFormat: InsertTextFormat.Snippet,
    }));
  }

  /** Build an instruction snippet from an opcode entry */
  private buildInstructionSnippet(op: typeof OPCODES[0]): string {
    const nonNoneOperands = op.operands.filter(o => o.type !== 'none');
    if (nonNoneOperands.length === 0) return op.mnemonic;

    const operandPlaceholders = nonNoneOperands.map((o, i) => {
      if (o.type === 'reg') return `\${${i + 1}:R0}`;
      if (o.type === 'freg') return `\${${i + 1}:F0}`;
      if (o.type === 'vreg') return `\${${i + 1}:V0}`;
      if (o.type === 'imm') return `\${${i + 1}:0}`;
      if (o.type === 'label') return `\${${i + 1}:@label}`;
      if (o.type === 'str') return `\${${i + 1}:\\"\\"}`;
      return `\${${i + 1}}`;
    });

    return `${op.mnemonic} ${operandPlaceholders.join(', ')}`;
  }

  /** Register completions */
  private getRegisterCompletions(): CompletionItem[] {
    return ALL_REGISTERS.map(r => ({
      label: r.name,
      kind: CompletionItemKind.Variable,
      detail: r.description,
      documentation: `${r.name} (${r.type})`,
    }));
  }

  /** Type completions for type annotations */
  private getTypeCompletions(): CompletionItem[] {
    return PRIMITIVE_TYPES.map(t => ({
      label: t,
      kind: CompletionItemKind.TypeParameter,
      detail: `FLUX primitive type: ${t}`,
    }));
  }

  /** Default completions (when context is unclear) */
  private getDefaultCompletions(): CompletionItem[] {
    // Top-level completions: sections, directives, and common patterns
    const items: CompletionItem[] = [];
    items.push(...this.getSectionCompletions());
    items.push(...this.getDirectiveCompletions());
    items.push({
      label: '---',
      kind: CompletionItemKind.Snippet,
      detail: 'YAML frontmatter delimiters',
      documentation: 'Insert YAML frontmatter block',
      insertText: '---\ntitle: ${1:Module Title}\nversion: ${2:1.0}\ndescription: ${3:A FLUX module}\n---\n',
      insertTextFormat: InsertTextFormat.Snippet,
    });
    return items;
  }

  /** Check if a line number is inside a flux code block */
  private isInFluxCodeBlock(ast: FluxModule, line: number): boolean {
    return this.findCodeBlockAtLine(ast, line) !== null;
  }

  /** Find the code block containing a line, if any */
  private findCodeBlockAtLine(ast: FluxModule, line: number): { node: FluxModule['children'][0]; dialect: string } | null {
    for (const child of ast.children) {
      if (child.type === NodeType.CODE_BLOCK) {
        const cb = child as import('./types').CodeBlockNode;
        if (line >= cb.contentRange.start.line && line < cb.contentRange.end.line) {
          if (cb.dialect === CodeBlockDialect.FLUX) {
            return { node: child, dialect: cb.rawDialect };
          }
        }
      }
    }
    return null;
  }

  /** Check if we're likely in a type annotation context */
  private isInTypeContext(ast: FluxModule, line: number): boolean {
    // Look for a section heading with fn: nearby
    for (const child of ast.children) {
      if (child.type === NodeType.SECTION_HEADING) {
        const heading = child as SectionHeadingNode;
        // Check if within 5 lines of the heading
        if (Math.abs(heading.range.start.line - line) <= 5) {
          return true;
        }
      }
    }
    return false;
  }
}
