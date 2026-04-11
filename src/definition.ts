/**
 * definition.ts — Go-to-definition provider for .flux.md files
 *
 * WHY: In .flux.md files, section headings (## fn:, ## tile:, etc.) and label
 * definitions (@name:) act as definition sites. Instructions like CALL @fn_name
 * and JMP @label reference these definitions. The go-to-definition provider lets
 * developers navigate from a call/jump to its target with a single click.
 *
 * DECISION: Currently scope-limited to single-file navigation. Rationale: Cross-file
 * navigation would require a workspace-wide symbol index (like a tags file) and
 * module resolution (resolving #!import paths to files). That's a valuable feature
 * but significantly more complex. Single-file navigation captures the most common
 * case (navigating within a module) and can be extended later.
 *
 * TIMESTAMP: 2026-04-12T02:40:00Z — Session 8, LSP scaffolding
 */

import {
  DefinitionParams,
  Location,
  Position,
  Range,
} from 'vscode-languageserver/node';

import {
  FluxModule,
  NodeType,
  SectionHeadingNode,
  InstructionNode,
  LabelDefNode,
  SectionType,
} from './types';
import { DocumentManager } from './document-manager';

export class FluxDefinitionProvider {
  private docManager: DocumentManager;

  constructor(docManager: DocumentManager) {
    this.docManager = docManager;
  }

  /** Get definition location for a symbol at the given position */
  getDefinition(uri: string, position: Position): Location | null {
    const entry = this.docManager.getDocument(uri);
    if (!entry) return null;

    const line = entry.document.getText({
      start: { line: position.line, character: 0 },
      end: { line: position.line, character: 1000 },
    });

    // Extract the word at the cursor
    const word = this.getWordAtPosition(line, position.character);
    if (!word) return null;

    // Check if it's a label reference (@name)
    const labelRef = word.startsWith('@') ? word.substring(1) : null;
    if (labelRef) {
      return this.findLabelDefinition(entry.ast, labelRef, uri);
    }

    // Check if it's a function call (CALL fn_name pattern — mnemonic is CALL/JMP/JAL)
    const instrMatch = line.match(/(?:CALL|JMP|JAL|CALLL|JALL)\s+@?(\w+)/);
    if (instrMatch && instrMatch[1] === word) {
      return this.findSectionDefinition(entry.ast, word, uri);
    }

    // Check if it's a known section name
    return this.findSectionDefinition(entry.ast, word, uri);
  }

  /** Find a label definition in the AST */
  private findLabelDefinition(ast: FluxModule, name: string, uri: string): Location | null {
    for (const child of ast.children) {
      if (child.type === NodeType.LABEL_DEF) {
        const label = child as LabelDefNode;
        if (label.name === name) {
          return {
            uri,
            range: label.span.range,
          };
        }
      }
    }
    return null;
  }

  /** Find a section definition in the AST */
  private findSectionDefinition(ast: FluxModule, name: string, uri: string): Location | null {
    for (const child of ast.children) {
      if (child.type === NodeType.SECTION_HEADING) {
        const heading = child as SectionHeadingNode;
        if (heading.name === name) {
          return {
            uri,
            range: heading.nameSpan.range,
          };
        }
      }
    }
    return null;
  }

  /** Extract word at cursor position */
  private getWordAtPosition(line: string, character: number): string | null {
    const before = line.substring(0, character);
    const after = line.substring(character);

    const wordMatch = before.match(/[a-zA-Z_@][a-zA-Z0-9_]*$/);
    const afterMatch = after.match(/^[a-zA-Z0-9_]*/);

    if (wordMatch && afterMatch) {
      return wordMatch[0] + afterMatch[0];
    }
    return null;
  }
}
