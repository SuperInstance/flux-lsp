/**
 * hover.ts — Hover documentation provider for .flux.md files
 *
 * WHY: When a developer hovers over a FLUX mnemonic in their editor, they should
 * see the opcode, format, operand types, and a description — without leaving the
 * editor to look up the ISA spec. The hover provider connects the opcode table
 * to the cursor position, making the 247-opcode ISA browsable through natural
 * editor interaction.
 *
 * DECISION: Rich markdown hover content. Rationale: LSP supports markdown in
 * hover responses, and structured content (tables, code blocks, bold) is much
 * more readable than plain text. We show the opcode in a code block with its
 * operands, the format encoding, and a human-readable description. This matches
 * what developers expect from modern language servers (Rust-analyzer, pyright).
 *
 * TIMESTAMP: 2026-04-12T02:35:00Z — Session 8, LSP scaffolding
 */

import {
  Hover,
  MarkupKind,
  Position,
  Range,
} from 'vscode-languageserver/node';

import { lookupMnemonic, OPCODES } from './opcodes';
import { FluxModule, NodeType, CodeBlockNode, CodeBlockDialect, SectionHeadingNode } from './types';
import { DocumentManager } from './document-manager';

export class FluxHoverProvider {
  private docManager: DocumentManager;

  constructor(docManager: DocumentManager) {
    this.docManager = docManager;
  }

  /** Get hover information at a given position */
  getHover(uri: string, position: Position): Hover | null {
    const entry = this.docManager.getDocument(uri);
    if (!entry) return null;

    const line = entry.document.getText({
      start: { line: position.line, character: 0 },
      end: { line: position.line, character: 1000 },
    });

    // Try to find a mnemonic under the cursor
    const word = this.getWordAtPosition(line, position.character);

    if (!word) return null;

    // Check if it's an opcode mnemonic
    const opcode = lookupMnemonic(word);
    if (opcode) {
      return this.formatOpcodeHover(opcode);
    }

    // Check if it's a register
    if (this.isRegister(word)) {
      return this.formatRegisterHover(word);
    }

    // Check if it's a section heading
    const sectionDef = this.findSectionDef(entry.ast, word);
    if (sectionDef) {
      return this.formatSectionHover(sectionDef);
    }

    return null;
  }

  /** Format hover content for an opcode */
  private formatOpcodeHover(opcode: NonNullable<ReturnType<typeof lookupMnemonic>>): Hover {
    const operands = opcode.operands
      .filter(op => op.type !== 'none')
      .map(op => `${op.name}(${op.type})`)
      .join(', ');

    const example = opcode.example || `${opcode.mnemonic} ...`;

    const content = `**${opcode.mnemonic}** \`0x${opcode.opcode.toString(16).padStart(2, '0')}\`

**Format:** ${opcode.format} | **Category:** ${opcode.category}

**Operands:** ${operands || 'none'}

${opcode.description}

\`\`\`flux
${example}
\`\`\`
`;

    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: content,
      },
    };
  }

  /** Format hover content for a register */
  private formatRegisterHover(name: string): Hover {
    const regDescriptions: Record<string, string> = {
      'SP': 'Stack Pointer (R11) — points to top of stack',
      'FP': 'Frame Pointer (R14) — points to current stack frame',
      'LR': 'Link Register (R15) — stores return address',
      'PC': 'Program Counter — current instruction address (read-only)',
      'FLAGS': 'Status Flags — Z(zero), S(sign), C(carry), V(overflow)',
    };

    const desc = regDescriptions[name];
    if (desc) {
      return {
        contents: {
          kind: MarkupKind.Markdown,
          value: `**${name}** — ${desc}`,
        },
      };
    }

    // General purpose register
    const upper = name.toUpperCase();
    let regType = 'General-purpose integer';
    if (upper.startsWith('F')) regType = 'Floating-point';
    if (upper.startsWith('V')) regType = 'SIMD vector';

    const num = parseInt(upper.replace(/[RFV]/, ''));

    let extra = '';
    if (upper === 'R11') extra = ' (also SP)';
    if (upper === 'R14') extra = ' (also FP)';
    if (upper === 'R15') extra = ' (also LR)';

    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: `**${upper}** — ${regType} register #${num}${extra}`,
      },
    };
  }

  /** Format hover content for a section definition */
  private formatSectionHover(section: { type: string; name: string; range: Range }): Hover {
    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: `**${section.type}** \`${section.name}\`\n\nDefined at line ${section.range.start.line + 1}`,
      },
    };
  }

  /** Find a section definition by name */
  private findSectionDef(ast: FluxModule, name: string): { type: string; name: string; range: Range } | null {
    for (const child of ast.children) {
      if (child.type === NodeType.SECTION_HEADING) {
        const heading = child as SectionHeadingNode;
        if (heading.name === name) {
          return {
            type: heading.sectionType,
            name: heading.name,
            range: heading.range,
          };
        }
      }
    }
    return null;
  }

  /** Extract the word at the cursor position */
  private getWordAtPosition(line: string, character: number): string | null {
    // Match a word boundary around the character
    // Words can be: mnemonics (UPPER_CASE), registers (R0, F0, V0), identifiers
    const before = line.substring(0, character);
    const after = line.substring(character);

    const wordMatch = before.match(/[a-zA-Z_@][a-zA-Z0-9_]*$/);
    const afterMatch = after.match(/^[a-zA-Z0-9_]*/);

    if (wordMatch && afterMatch) {
      return wordMatch[0] + afterMatch[0];
    }
    return null;
  }

  /** Check if a string looks like a register name */
  private isRegister(word: string): boolean {
    const upper = word.toUpperCase();
    if (upper.match(/^[RFV](1[0-5]|[0-9])$/)) return true;
    if (['SP', 'FP', 'LR', 'PC', 'FLAGS'].includes(upper)) return true;
    return false;
  }
}
