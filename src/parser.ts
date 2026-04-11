/**
 * parser.ts — .flux.md parser that produces an AST
 *
 * WHY: The LSP providers (completion, hover, diagnostics, go-to-definition) operate
 * on a structured AST, not raw text. The parser bridges the gap between the lexer's
 * flat token stream and the hierarchical tree structure needed for semantic analysis.
 *
 * DECISION: Two-phase parsing approach. Phase 1 (structural) splits the document
 * into sections, code blocks, directives, and text using line-level pattern matching.
 * Phase 2 (detailed) parses code block contents into instruction-level AST nodes.
 * Rationale: .flux.md is fundamentally a markdown document with embedded code. Most
 * LSP queries (hover on a section heading, complete a mnemonic) only need structural
 * parsing. Detailed instruction parsing is only needed for diagnostics and completion
 * inside code blocks. Splitting these phases avoids unnecessary work.
 *
 * TIMESTAMP: 2026-04-12T02:20:00Z — Session 8, LSP scaffolding
 */

import {
  FluxNode,
  FluxModule,
  NodeType,
  SectionType,
  DirectiveKey,
  DirectiveNode,
  SectionHeadingNode,
  CodeBlockNode,
  CodeBlockDialect,
  ParagraphNode,
  ListBlockNode,
  InstructionNode,
  LabelDefNode,
  FnSignature,
  FnParam,
  SourceSpan,
  Range,
} from './types';

/** Classify a code block dialect */
function classifyDialect(raw: string): CodeBlockDialect {
  switch (raw.toLowerCase()) {
    case 'flux':
    case 'fluxfn':
    case 'flux-type':
      return CodeBlockDialect.FLUX;
    case 'fir':
      return CodeBlockDialect.FIR;
    case 'fluxvocab':
      return CodeBlockDialect.FLUXVOCAB;
    case 'json':
      return CodeBlockDialect.JSON;
    case 'yaml':
    case 'yml':
      return CodeBlockDialect.YAML;
    default:
      return CodeBlockDialect.NATIVE;
  }
}

/** Check if a dialect is a FLUX code dialect (assembly) */
function isFluxCodeDialect(dialect: string): boolean {
  const d = dialect.toLowerCase();
  return d === 'flux' || d === 'fluxfn' || d === 'flux-type';
}

/** Parse section type from heading keyword */
function parseSectionType(keyword: string): SectionType | null {
  switch (keyword.toLowerCase()) {
    case 'fn': return SectionType.FN;
    case 'agent': return SectionType.AGENT;
    case 'tile': return SectionType.TILE;
    case 'region': return SectionType.REGION;
    case 'vocabulary': return SectionType.VOCABULARY;
    case 'test': return SectionType.TEST;
    default: return null;
  }
}

/** Parse a directive key string */
function parseDirectiveKey(raw: string): { key: DirectiveKey; raw: string } | null {
  const known: Record<string, DirectiveKey> = {
    'capability': DirectiveKey.CAPABILITY,
    'import': DirectiveKey.IMPORT,
    'export': DirectiveKey.EXPORT,
    'deprecated': DirectiveKey.DEPRECATED,
    'experimental': DirectiveKey.EXPERIMENTAL,
    'require': DirectiveKey.REQUIRE,
    'feature': DirectiveKey.FEATURE,
    'optimize': DirectiveKey.OPTIMIZE,
    'unsafe': DirectiveKey.UNSAFE,
    'test': DirectiveKey.TEST,
    'bench': DirectiveKey.BENCH,
  };
  const key = known[raw];
  return key ? { key, raw } : null;
}

export class Parser {
  private text: string;
  private lines: string[];

  constructor(text: string) {
    this.text = text;
    this.lines = text.split('\n');
  }

  /** Parse the full document into a FluxModule AST */
  parse(uri: string = 'untitled'): FluxModule {
    const children: FluxNode[] = [];
    let frontmatter: Map<string, string> | null = null;
    let lineNum = 0;

    // Parse YAML frontmatter
    if (this.lines.length > 0 && this.lines[0].trim() === '---') {
      frontmatter = new Map();
      lineNum = 1;
      while (lineNum < this.lines.length && this.lines[lineNum].trim() !== '---') {
        const line = this.lines[lineNum];
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const key = line.substring(0, colonIdx).trim();
          const value = line.substring(colonIdx + 1).trim();
          frontmatter.set(key, value);
        }
        lineNum++;
      }
      lineNum++; // skip closing ---
    }

    // Parse body (sections, directives, code blocks, text)
    while (lineNum < this.lines.length) {
      const line = this.lines[lineNum];

      // Empty line
      if (line.trim() === '') {
        lineNum++;
        continue;
      }

      // Directive: #!key value
      const directiveMatch = line.match(/^(#!\w+)\s*(.*)/);
      if (directiveMatch) {
        const directiveText = directiveMatch[1]; // e.g., "#!capability"
        const keyStr = directiveText.substring(2); // e.g., "capability"
        const value = directiveMatch[2].trim();
        const parsed = parseDirectiveKey(keyStr);

        children.push({
          type: NodeType.DIRECTIVE_NODE,
          key: parsed?.key ?? DirectiveKey.FEATURE, // default unknown directives to FEATURE
          rawKey: keyStr,
          value,
          range: this.lineRange(lineNum, 0, line.length),
        } as DirectiveNode);

        lineNum++;
        continue;
      }

      // Section heading: ## type: name
      const sectionMatch = line.match(/^(#{2,})\s+(fn|agent|tile|region|vocabulary|test)\s*[:\s](.*)/i);
      if (sectionMatch) {
        const headingNode = this.parseSectionHeading(sectionMatch, lineNum);
        const sectionChildren = this.parseSectionBody(lineNum + 1);
        children.push(headingNode);
        children.push(...sectionChildren.nodes);
        lineNum = sectionChildren.nextLine;
        continue;
      }

      // Code block opening
      const codeBlockMatch = line.match(/^(`{3,})(\w*)/);
      if (codeBlockMatch) {
        const codeBlock = this.parseCodeBlock(lineNum, codeBlockMatch[1].length, codeBlockMatch[2]);
        if (codeBlock) {
          children.push(codeBlock);
          // Parse instructions inside flux code blocks at top level too
          if (codeBlock.dialect === CodeBlockDialect.FLUX) {
            const instructions = this.parseInstructions(codeBlock.content, codeBlock.contentRange.start.line);
            children.push(...instructions);
          }
        }
        lineNum = codeBlock ? codeBlock.range.end.line + 1 : lineNum + 1;
        continue;
      }

      // List block (detect ordered/unordered)
      const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)/);
      if (listMatch) {
        const listBlock = this.parseListBlock(lineNum);
        children.push(listBlock.node);
        lineNum = listBlock.nextLine;
        continue;
      }

      // Plain paragraph text
      const paragraph = this.parseParagraph(lineNum);
      if (paragraph) {
        children.push(paragraph.node);
        lineNum = paragraph.nextLine;
        continue;
      }

      lineNum++;
    }

    return {
      type: NodeType.FLUX_MODULE,
      uri,
      frontmatter,
      children,
      range: this.fullRange(),
    };
  }

  /** Parse a section heading (## fn: name(params) -> type) */
  private parseSectionHeading(match: RegExpMatchArray, lineNum: number): SectionHeadingNode {
    const keyword = match[2];
    const rest = match[3].trim();
    const sectionType = parseSectionType(keyword)!;

    // Parse function signature if present
    let signature: FnSignature | null = null;
    let name: string = rest;
    let flags: string[] = [];

    // Function signature: name(params) -> type [, flags]
    if (sectionType === SectionType.FN) {
      const sigMatch = rest.match(/^(\w+)\s*(?:\(([^)]*)\))?\s*(?:->\s*(.+?))?(?:\s*,\s*(.+))?$/);
      if (sigMatch) {
        name = sigMatch[1];
        const paramsStr = sigMatch[2] || '';
        const returnType = sigMatch[3]?.trim() || null;

        // Parse parameters
        const params: FnParam[] = [];
        if (paramsStr.trim()) {
          for (const paramStr of paramsStr.split(',')) {
            const paramMatch = paramStr.trim().match(/^(\w+)\s*:\s*(.+)$/);
            if (paramMatch) {
              params.push({
                name: paramMatch[1],
                typeExpr: paramMatch[2].trim(),
                span: this.spanFromLine(lineNum, paramStr),
              });
            }
          }
        }

        // Parse flags
        if (sigMatch[4]) {
          flags = sigMatch[4].split(',').map(f => f.trim()).filter(Boolean);
        }

        signature = { name, params, returnType, flags, span: this.spanFromLine(lineNum, rest) };
      }
    } else {
      // Non-function section: just name + optional flags
      const parts = rest.split(',').map(p => p.trim());
      name = parts[0];
      flags = parts.slice(1);
    }

    return {
      type: NodeType.SECTION_HEADING,
      sectionType,
      name,
      signature,
      flags,
      range: this.lineRange(lineNum, 0, this.lines[lineNum].length),
      nameSpan: this.spanFromLine(lineNum, name),
    };
  }

  /** Parse the body of a section until the next ## heading or EOF */
  private parseSectionBody(startLine: number): { nodes: FluxNode[]; nextLine: number } {
    const nodes: FluxNode[] = [];
    let lineNum = startLine;

    while (lineNum < this.lines.length) {
      const line = this.lines[lineNum];

      // Next section heading ends this body
      if (line.match(/^##\s+/)) {
        break;
      }

      // Empty line
      if (line.trim() === '') {
        lineNum++;
        continue;
      }

      // Directive
      const directiveMatch = line.match(/^(#!\w+)\s*(.*)/);
      if (directiveMatch) {
        const keyStr = directiveMatch[1].substring(2);
        const parsed = parseDirectiveKey(keyStr);
        nodes.push({
          type: NodeType.DIRECTIVE_NODE,
          key: parsed?.key ?? DirectiveKey.FEATURE,
          rawKey: keyStr,
          value: directiveMatch[2].trim(),
          range: this.lineRange(lineNum, 0, line.length),
        } as DirectiveNode);
        lineNum++;
        continue;
      }

      // Code block
      const codeBlockMatch = line.match(/^(`{3,})(\w*)/);
      if (codeBlockMatch) {
        const codeBlock = this.parseCodeBlock(lineNum, codeBlockMatch[1].length, codeBlockMatch[2]);
        if (codeBlock) {
          nodes.push(codeBlock);
          // Parse instructions inside flux code blocks
          if (isFluxCodeDialect(codeBlock.rawDialect)) {
            const instructions = this.parseInstructions(codeBlock.content, codeBlock.contentRange.start.line);
            nodes.push(...instructions);
          }
        }
        lineNum = codeBlock ? codeBlock.range.end.line + 1 : lineNum + 1;
        continue;
      }

      // List
      const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)/);
      if (listMatch) {
        const listBlock = this.parseListBlock(lineNum);
        nodes.push(listBlock.node);
        lineNum = listBlock.nextLine;
        continue;
      }

      // Paragraph
      const paragraph = this.parseParagraph(lineNum);
      if (paragraph) {
        nodes.push(paragraph.node);
        lineNum = paragraph.nextLine;
        continue;
      }

      lineNum++;
    }

    return { nodes, nextLine: lineNum };
  }

  /** Parse a code block (opening fence to closing fence) */
  private parseCodeBlock(startLine: number, fenceLen: number, rawDialect: string): CodeBlockNode | null {
    const startContent = startLine + 1;
    let endLine = startLine;

    // Find closing fence
    for (let i = startLine + 1; i < this.lines.length; i++) {
      const closeMatch = this.lines[i].match(new RegExp(`^` + '`'.repeat(fenceLen) + '\\s*$'));
      if (closeMatch) {
        endLine = i;
        break;
      }
    }

    if (endLine === startLine) {
      return null; // Unclosed code block — treat as text
    }

    const content = this.lines.slice(startContent, endLine).join('\n');
    const dialect = classifyDialect(rawDialect);

    // Extract meta string (anything after the language tag on the opening line)
    const openingLine = this.lines[startLine];
    const metaMatch = openingLine.match(/^`{3,}\w*\s+(.*)/);
    const meta = metaMatch ? metaMatch[1].trim() : '';

    return {
      type: NodeType.CODE_BLOCK,
      dialect,
      rawDialect,
      content,
      meta,
      range: this.lineRange(startLine, 0, this.lines[endLine].length),
      contentRange: {
        start: { line: startContent, character: 0 },
        end: { line: endLine, character: 0 },
      },
    };
  }

  /** Parse assembly instructions from code block content */
  private parseInstructions(content: string, startLine: number): (InstructionNode | LabelDefNode)[] {
    const nodes: (InstructionNode | LabelDefNode)[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const actualLine = startLine + i;

      // Empty line
      if (line.trim() === '') continue;

      // Comment-only line
      if (line.trim().startsWith(';') || line.trim().startsWith('#')) continue;

      // Label definition: @name:
      const labelMatch = line.match(/^\s*@([a-zA-Z_]\w*):/);
      if (labelMatch) {
        nodes.push({
          type: NodeType.LABEL_DEF,
          name: labelMatch[1],
          range: this.lineRange(actualLine, 0, line.length),
          span: this.spanFromLine(actualLine, labelMatch[0]),
        });
        continue;
      }

      // Instruction line: [label:] MNEMONIC operand1, operand2, operand3 [; comment]
      const trimmed = line.trim();

      // Skip if it's a vocabulary word definition (:word)
      if (trimmed.startsWith(':')) continue;

      // Parse instruction
      const instrMatch = trimmed.match(
        /^(?:(@[a-zA-Z_]\w*):)?\s*([A-Z][A-Z0-9_]*)\s*(.*)?$/
      );
      if (instrMatch) {
        const label = instrMatch[1] ? instrMatch[1].substring(1) : null; // strip @
        const mnemonic = instrMatch[2];
        const rest = instrMatch[3] || '';

        // Parse operands (split by comma, strip comments)
        let operandsStr = rest;
        let comment: string | null = null;
        const commentIdx = operandsStr.indexOf(';');
        if (commentIdx >= 0) {
          comment = operandsStr.substring(commentIdx).trim();
          operandsStr = operandsStr.substring(0, commentIdx).trim();
        }

        const operands = operandsStr
          .split(',')
          .map(o => o.trim())
          .filter(o => o.length > 0 && o !== '-'); // filter empty and unused '-'

        nodes.push({
          type: NodeType.INSTRUCTION,
          mnemonic,
          operands,
          comment,
          label,
          range: this.lineRange(actualLine, 0, line.length),
          mnemonicSpan: this.spanFromLine(actualLine, mnemonic),
        });
      }
    }

    return nodes;
  }

  /** Parse a paragraph (consecutive non-empty, non-structure lines) */
  private parseParagraph(startLine: number): { node: ParagraphNode; nextLine: number } | null {
    if (startLine >= this.lines.length) return null;
    const line = this.lines[startLine];
    if (line.trim() === '') return null;

    const lines: string[] = [line];
    let endLine = startLine;

    for (let i = startLine + 1; i < this.lines.length; i++) {
      const next = this.lines[i];
      // End paragraph on empty lines or structure markers
      if (next.trim() === '' || next.match(/^#{1,6}\s+/) || next.match(/^#!/) || next.match(/^`{3,}/) || next.match(/^\s*[-*]\s/) || next.match(/^\s*\d+\.\s/)) {
        break;
      }
      lines.push(next);
      endLine = i;
    }

    const text = lines.join('\n');
    return {
      node: {
        type: NodeType.PARAGRAPH,
        text,
        range: this.lineRange(startLine, 0, this.lines[endLine].length),
      },
      nextLine: endLine + 1,
    };
  }

  /** Parse a list block (ordered or unordered) */
  private parseListBlock(startLine: number): { node: ListBlockNode; nextLine: number } {
    const items: string[] = [];
    let lineNum = startLine;
    let ordered = false;

    while (lineNum < this.lines.length) {
      const line = this.lines[lineNum];
      const match = line.match(/^\s*(-|\*)\s+(.*)/);
      const orderedMatch = line.match(/^\s*(\d+)\.\s+(.*)/);

      if (match) {
        ordered = false;
        items.push(match[2].trim());
        lineNum++;
      } else if (orderedMatch) {
        ordered = true;
        items.push(orderedMatch[2].trim());
        lineNum++;
      } else {
        break;
      }
    }

    return {
      node: {
        type: NodeType.LIST_BLOCK,
        ordered,
        items,
        range: this.lineRange(startLine, 0, this.lines[lineNum - 1]?.length || 0),
      },
      nextLine: lineNum,
    };
  }

  // ─── Position Helpers ───

  private lineRange(line: number, startChar: number, endChar: number): Range {
    return {
      start: { line, character: startChar },
      end: { line, character: endChar },
    };
  }

  private fullRange(): Range {
    const lastLine = this.lines.length - 1;
    return {
      start: { line: 0, character: 0 },
      end: { line: lastLine, character: this.lines[lastLine]?.length || 0 },
    };
  }

  private spanFromLine(line: number, text: string): SourceSpan {
    // Find text position in the line
    const lineContent = this.lines[line] || '';
    let startChar = lineContent.indexOf(text);
    if (startChar < 0) startChar = 0;
    return {
      range: {
        start: { line, character: startChar },
        end: { line, character: startChar + text.length },
      },
      source: text,
    };
  }
}
