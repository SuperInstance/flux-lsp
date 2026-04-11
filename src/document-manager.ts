/**
 * document-manager.ts — Manages parsed .flux.md documents for the LSP
 *
 * WHY: LSP servers manage multiple documents simultaneously. Each open file needs
 * its own parsed AST that gets invalidated and re-parsed when the file changes.
 * The DocumentManager provides a thin cache layer so that completion, hover, and
 * diagnostics providers can always get the current AST for any URI.
 *
 * DECISION: Simple Map-based cache rather than an LRU cache. Rationale: LSP
 * instances typically handle a small number of files (< 50). An LRU cache adds
 * complexity without measurable benefit. We invalidate the entire entry on change
 * rather than doing incremental parsing — incremental markdown parsing is
 * notoriously difficult and error-prone, and full re-parse of .flux.md files is
 * fast (< 1ms for typical file sizes).
 *
 * TIMESTAMP: 2026-04-12T02:25:00Z — Session 8, LSP scaffolding
 */

import { TextDocument } from 'vscode-languageserver-textdocument';
import { FluxModule, FluxNode, NodeType, SectionHeadingNode, CodeBlockNode, InstructionNode, LabelDefNode, DirectiveNode, SectionType, SymbolDef, SymbolRef, FluxDiagnostic, FluxDiagnosticSeverity } from './types';
import { Parser } from './parser';
import { lookupMnemonic, GP_REGISTERS, FP_REGISTERS, VEC_REGISTERS, SPECIAL_REGISTERS } from './opcodes';

export interface DocumentEntry {
  document: TextDocument;
  ast: FluxModule;
  symbols: SymbolDef[];
  diagnostics: FluxDiagnostic[];
  version: number;
}

export class DocumentManager {
  private documents = new Map<string, DocumentEntry>();

  /** Open a new document or update an existing one */
  openDocument(textDocument: TextDocument): DocumentEntry {
    const uri = textDocument.uri;
    const text = textDocument.getText();
    const parser = new Parser(text);
    const ast = parser.parse(uri);
    const symbols = this.extractSymbols(ast, uri);
    const diagnostics = this.analyze(ast, uri);

    const entry: DocumentEntry = {
      document: textDocument,
      ast,
      symbols,
      diagnostics,
      version: textDocument.version,
    };

    this.documents.set(uri, entry);
    return entry;
  }

  /** Close a document */
  closeDocument(uri: string): void {
    this.documents.delete(uri);
  }

  /** Get a document entry by URI */
  getDocument(uri: string): DocumentEntry | undefined {
    return this.documents.get(uri);
  }

  /** Get AST for a document */
  getAST(uri: string): FluxModule | undefined {
    return this.documents.get(uri)?.ast;
  }

  /** Get symbols for a document */
  getSymbols(uri: string): SymbolDef[] {
    return this.documents.get(uri)?.symbols || [];
  }

  /** Get all known symbols across all open documents */
  getAllSymbols(): SymbolDef[] {
    const symbols: SymbolDef[] = [];
    for (const entry of this.documents.values()) {
      symbols.push(...entry.symbols);
    }
    return symbols;
  }

  /** Extract symbol definitions from an AST */
  private extractSymbols(ast: FluxModule, uri: string): SymbolDef[] {
    const symbols: SymbolDef[] = [];

    for (const node of ast.children) {
      if (node.type === NodeType.SECTION_HEADING) {
        const heading = node as SectionHeadingNode;
        symbols.push({
          name: heading.name,
          kind: heading.sectionType as SymbolDef['kind'],
          node,
          range: heading.range,
          uri,
        });
      }

      // Extract labels from code blocks
      if (node.type === NodeType.LABEL_DEF) {
        const label = node as LabelDefNode;
        symbols.push({
          name: label.name,
          kind: 'label',
          node,
          range: label.range,
          containerRange: label.range,
          uri,
        });
      }
    }

    return symbols;
  }

  /** Analyze a parsed AST for diagnostics */
  private analyze(ast: FluxModule, uri: string): FluxDiagnostic[] {
    const diagnostics: FluxDiagnostic[] = [];

    for (const child of ast.children) {
      // Check instructions for unknown mnemonics
      if (child.type === NodeType.INSTRUCTION) {
        const instr = child as InstructionNode;
        const opcode = lookupMnemonic(instr.mnemonic);
        if (!opcode) {
          diagnostics.push({
            severity: FluxDiagnosticSeverity.ERROR,
            message: `Unknown mnemonic '${instr.mnemonic}'`,
            range: instr.mnemonicSpan.range,
            code: 'flux-001',
            source: 'flux-lsp',
          });
        } else {
          // Check operand count
          const expectedOperands = opcode.operands.filter(op => op.type !== 'none').length;
          if (instr.operands.length > 0 && instr.operands.length !== expectedOperands) {
            // Only warn if the instruction has explicit operands that don't match
            // (some instructions like MOV may be used with fewer operands in practice)
            if (instr.operands.length < expectedOperands) {
              diagnostics.push({
                severity: FluxDiagnosticSeverity.WARNING,
                message: `${instr.mnemonic} expects ${expectedOperands} operands, got ${instr.operands.length}`,
                range: child.range,
                code: 'flux-002',
                source: 'flux-lsp',
              });
            }
          }

          // Check register validity
          for (const op of instr.operands) {
            const upperOp = op.toUpperCase().replace('@', '');
            const isReg = upperOp.match(/^[RFV](1[0-5]|[0-9])$/) || ['SP', 'FP', 'LR', 'PC', 'FLAGS'].includes(upperOp);
            if (isReg) {
              const num = parseInt(upperOp.replace(/[RFV]/, ''));
              if (upperOp.startsWith('R') && (num < 0 || num > 15)) {
                diagnostics.push({
                  severity: FluxDiagnosticSeverity.ERROR,
                  message: `Register ${upperOp} out of range (R0-R15)`,
                  range: child.range,
                  code: 'flux-003',
                  source: 'flux-lsp',
                });
              }
            }
          }
        }
      }
    }

    return diagnostics;
  }
}
