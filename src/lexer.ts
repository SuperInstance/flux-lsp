/**
 * lexer.ts — Tokenizer for .flux.md files
 *
 * WHY: The LSP needs to understand the structure of .flux.md files at the token
 * level to provide completion (what can come next?), hover (what is under the
 * cursor?), and diagnostics (is this valid?). The lexer sits between raw text
 * and the parser — it turns a stream of characters into a stream of typed tokens.
 *
 * DECISION: We use a line-by-line lexer rather than a character-by-character state
 * machine. Rationale: .flux.md is fundamentally a line-oriented format (like
 * Python or YAML). Section headings, directives, and labels are all line-anchored.
 * Only code blocks need character-level scanning. By processing line-by-line, we
 * can quickly classify most lines (heading? directive? blank?) and only do
 * detailed scanning inside code blocks. This also makes error reporting easier
 * since we always have line context.
 *
 * TIMESTAMP: 2026-04-12T02:10:00Z — Session 8, LSP scaffolding
 */

import {
  Token,
  TokenType,
  Range,
  Position,
} from './types';

/** Lexer state for tracking code block context */
interface LexerState {
  inCodeBlock: boolean;
  codeBlockDialect: string;
  codeBlockDepth: number;  // for nested ``` counting
  inFrontmatter: boolean;
  frontmatterClosed: boolean;
}

export class Lexer {
  private text: string;
  private lines: string[];
  private state: LexerState;

  constructor(text: string) {
    this.text = text;
    this.lines = text.split('\n');
    this.state = {
      inCodeBlock: false,
      codeBlockDialect: '',
      codeBlockDepth: 0,
      inFrontmatter: false,
      frontmatterClosed: false,
    };
  }

  /** Tokenize the entire document, returning all tokens */
  tokenize(): Token[] {
    const tokens: Token[] = [];
    // Reset state
    this.state = {
      inCodeBlock: false,
      codeBlockDialect: '',
      codeBlockDepth: 0,
      inFrontmatter: false,
      frontmatterClosed: false,
    };

    for (let lineNum = 0; lineNum < this.lines.length; lineNum++) {
      const line = this.lines[lineNum];
      const lineTokens = this.tokenizeLine(line, lineNum);
      tokens.push(...lineTokens);

      // Add newline token (except for last line if it doesn't end with \n)
      if (lineNum < this.lines.length - 1) {
        tokens.push({
          type: TokenType.NEWLINE,
          value: '\n',
          range: { start: { line: lineNum, character: line.length }, end: { line: lineNum, character: line.length + 1 } },
          line: lineNum,
          offset: line.length,
        });
      }
    }

    // EOF token
    const lastLine = this.lines.length - 1;
    const lastLineLen = lastLine >= 0 ? this.lines[lastLine].length : 0;
    tokens.push({
      type: TokenType.EOF,
      value: '',
      range: { start: { line: lastLine + 1, character: 0 }, end: { line: lastLine + 1, character: 0 } },
      line: lastLine + 1,
      offset: 0,
    });

    return tokens;
  }

  /** Tokenize a single line */
  private tokenizeLine(line: string, lineNum: number): Token[] {
    const tokens: Token[] = [];

    // ── Frontmatter detection ──
    if (!this.state.inCodeBlock) {
      // Opening frontmatter
      if (line.trim() === '---' && !this.state.inFrontmatter && !this.state.frontmatterClosed && lineNum === 0) {
        this.state.inFrontmatter = true;
        tokens.push(this.makeToken(TokenType.FRONTMATTER_OPEN, '---', lineNum, 0, 3));
        return tokens;
      }
      // Closing frontmatter
      if (this.state.inFrontmatter && line.trim() === '---') {
        this.state.inFrontmatter = false;
        this.state.frontmatterClosed = true;
        tokens.push(this.makeToken(TokenType.FRONTMATTER_CLOSE, '---', lineNum, 0, 3));
        return tokens;
      }
      // Inside frontmatter — treat as text
      if (this.state.inFrontmatter) {
        tokens.push(this.makeToken(TokenType.TEXT, line, lineNum, 0, line.length));
        return tokens;
      }
    }

    // ── Code block boundaries ──
    const fenceMatch = line.match(/^(`{3,})(\w*)/);
    if (fenceMatch && !this.state.inFrontmatter) {
      if (!this.state.inCodeBlock) {
        // Opening code fence
        this.state.inCodeBlock = true;
        this.state.codeBlockDialect = fenceMatch[2] || '';
        this.state.codeBlockDepth = fenceMatch[1].length;
        tokens.push(this.makeToken(TokenType.CODE_FENCE_OPEN, fenceMatch[0], lineNum, 0, fenceMatch[0].length));
        return tokens;
      } else {
        // Check if this closes the code block (same number of backticks or more)
        const backtickStr = '`'.repeat(this.state.codeBlockDepth);
        const closePattern = new RegExp('^' + backtickStr + '\\s*$');
        const closeMatch = line.match(closePattern);
        if (closeMatch) {
          this.state.inCodeBlock = false;
          this.state.codeBlockDialect = '';
          tokens.push(this.makeToken(TokenType.CODE_FENCE_CLOSE, line.trim(), lineNum, 0, line.trim().length));
          return tokens;
        }
      }
    }

    // ── Inside code block — tokenize as assembly/data ──
    if (this.state.inCodeBlock) {
      return this.tokenizeCodeBlockLine(line, lineNum);
    }

    // ── Markdown structure (outside code blocks) ──

    // Section headings: ## fn:, ## agent:, etc.
    const sectionMatch = line.match(/^(#{2,})\s+(fn|agent|tile|region|vocabulary|test)\s*[:\s](.*)/i);
    if (sectionMatch) {
      tokens.push(this.makeToken(TokenType.SECTION_HEADING, line.trim(), lineNum, 0, line.trim().length));
      return tokens;
    }

    // Markdown headings (non-section)
    const mdHeadingMatch = line.match(/^(#{1,6})\s+/);
    if (mdHeadingMatch) {
      tokens.push(this.makeToken(TokenType.MARKDOWN_HEADING, line.trim(), lineNum, 0, line.trim().length));
      return tokens;
    }

    // Directives: #!key value
    const directiveMatch = line.match(/^(#!\w+)\s*(.*)/);
    if (directiveMatch) {
      tokens.push(this.makeToken(TokenType.DIRECTIVE, directiveMatch[1], lineNum, 0, directiveMatch[1].length));
      // Parse the rest of the line for potential identifiers/strings
      const rest = directiveMatch[2];
      if (rest) {
        tokens.push(this.makeToken(TokenType.TEXT, rest, lineNum, directiveMatch[1].length + 1, line.length));
      }
      return tokens;
    }

    // Plain text line
    if (line.trim().length > 0) {
      tokens.push(this.makeToken(TokenType.TEXT, line, lineNum, 0, line.length));
    }

    return tokens;
  }

  /** Tokenize a line inside a code block (assembly-level tokens) */
  private tokenizeCodeBlockLine(line: string, lineNum: number): Token[] {
    const tokens: Token[] = [];
    let i = 0;

    // Skip leading whitespace
    const leadingWs = line.match(/^(\s*)/);
    if (leadingWs && leadingWs[1].length > 0) {
      i = leadingWs[1].length;
    }

    // Empty line inside code block
    if (i >= line.length) return tokens;

    // Comment (consumes rest of line)
    if (line[i] === ';') {
      tokens.push(this.makeToken(TokenType.LINE_COMMENT, line.substring(i), lineNum, i, line.length));
      return tokens;
    }
    if (line[i] === '#' && (i + 1 >= line.length || line[i + 1] !== '!')) {
      tokens.push(this.makeToken(TokenType.HASH_COMMENT, line.substring(i), lineNum, i, line.length));
      return tokens;
    }

    // Label definition: @name:
    const labelMatch = line.substring(i).match(/^@([a-zA-Z_]\w*):/);
    if (labelMatch) {
      const labelLen = labelMatch[0].length;
      tokens.push(this.makeToken(TokenType.LABEL, labelMatch[0], lineNum, i, i + labelLen));
      i += labelLen;

      // Skip whitespace after label
      while (i < line.length && line[i] === ' ') i++;
    }

    // Scan remaining tokens on the line
    while (i < line.length) {
      // Skip whitespace
      if (line[i] === ' ' || line[i] === '\t') {
        i++;
        continue;
      }

      // Comment — consume rest of line
      if (line[i] === ';') {
        tokens.push(this.makeToken(TokenType.LINE_COMMENT, line.substring(i), lineNum, i, line.length));
        return tokens;
      }
      if (line[i] === '#') {
        tokens.push(this.makeToken(TokenType.HASH_COMMENT, line.substring(i), lineNum, i, line.length));
        return tokens;
      }

      // String literal
      if (line[i] === '"') {
        let end = i + 1;
        while (end < line.length && line[end] !== '"') {
          if (line[end] === '\\') end++; // skip escaped char
          end++;
        }
        end = Math.min(end + 1, line.length);
        tokens.push(this.makeToken(TokenType.STRING_LITERAL, line.substring(i, end), lineNum, i, end));
        i = end;
        continue;
      }

      // GP Register: R0-R15 (check before mnemonic since R0 matches [A-Z]...)
      const gpRegMatch = line.substring(i).match(/^[Rr](1[0-5]|[0-9])\b/);
      if (gpRegMatch) {
        tokens.push(this.makeToken(TokenType.GP_REGISTER, gpRegMatch[0].toUpperCase(), lineNum, i, i + gpRegMatch[0].length));
        i += gpRegMatch[0].length;
        continue;
      }

      // Float Register: F0-F15
      const fpRegMatch = line.substring(i).match(/^[Ff](1[0-5]|[0-9])\b/);
      if (fpRegMatch) {
        tokens.push(this.makeToken(TokenType.FP_REGISTER, fpRegMatch[0].toUpperCase(), lineNum, i, i + fpRegMatch[0].length));
        i += fpRegMatch[0].length;
        continue;
      }

      // Vector Register: V0-V15
      const vecRegMatch = line.substring(i).match(/^[Vv](1[0-5]|[0-9])\b/);
      if (vecRegMatch) {
        tokens.push(this.makeToken(TokenType.VEC_REGISTER, vecRegMatch[0].toUpperCase(), lineNum, i, i + vecRegMatch[0].length));
        i += vecRegMatch[0].length;
        continue;
      }

      // Special Registers
      const specialRegMatch = line.substring(i).match(/^(SP|FP|LR|PC|FLAGS)\b/);
      if (specialRegMatch) {
        tokens.push(this.makeToken(TokenType.SPECIAL_REGISTER, specialRegMatch[1], lineNum, i, i + specialRegMatch[1].length));
        i += specialRegMatch[1].length;
        continue;
      }

      // Mnemonic: uppercase word (at least 2 chars or multi-char after first)
      const mnemonicMatch = line.substring(i).match(/^[A-Z][A-Z0-9_]{1,}/);
      if (mnemonicMatch) {
        tokens.push(this.makeToken(TokenType.MNEMONIC, mnemonicMatch[0], lineNum, i, i + mnemonicMatch[0].length));
        i += mnemonicMatch[0].length;
        continue;
      }

      // Hex immediate: 0x... or 0X...
      const hexMatch = line.substring(i).match(/^0[xX][0-9a-fA-F]+/);
      if (hexMatch) {
        tokens.push(this.makeToken(TokenType.IMM_HEX, hexMatch[0], lineNum, i, i + hexMatch[0].length));
        i += hexMatch[0].length;
        continue;
      }

      // Binary immediate: 0b... or 0B...
      const binMatch = line.substring(i).match(/^0[bB][01]+/);
      if (binMatch) {
        tokens.push(this.makeToken(TokenType.IMM_BINARY, binMatch[0], lineNum, i, i + binMatch[0].length));
        i += binMatch[0].length;
        continue;
      }

      // Decimal immediate (possibly negative)
      const decMatch = line.substring(i).match(/^[+-]?\d+/);
      if (decMatch) {
        tokens.push(this.makeToken(TokenType.IMM_DECIMAL, decMatch[0], lineNum, i, i + decMatch[0].length));
        i += decMatch[0].length;
        continue;
      }

      // Label reference: @name (without trailing colon)
      const labelRefMatch = line.substring(i).match(/^@[a-zA-Z_]\w*/);
      if (labelRefMatch) {
        tokens.push(this.makeToken(TokenType.LABEL, labelRefMatch[0], lineNum, i, i + labelRefMatch[0].length));
        i += labelRefMatch[0].length;
        continue;
      }

      // Arrow for type signatures: ->
      if (line.substring(i).startsWith('->')) {
        tokens.push(this.makeToken(TokenType.ARROW, '->', lineNum, i, i + 2));
        i += 2;
        continue;
      }

      // Punctuation
      if (line[i] === ',') {
        tokens.push(this.makeToken(TokenType.COMMA, ',', lineNum, i, i + 1));
        i++;
        continue;
      }
      if (line[i] === ':') {
        tokens.push(this.makeToken(TokenType.COLON, ':', lineNum, i, i + 1));
        i++;
        continue;
      }
      if (line[i] === '(') {
        tokens.push(this.makeToken(TokenType.LPAREN, '(', lineNum, i, i + 1));
        i++;
        continue;
      }
      if (line[i] === ')') {
        tokens.push(this.makeToken(TokenType.RPAREN, ')', lineNum, i, i + 1));
        i++;
        continue;
      }
      if (line[i] === '[') {
        tokens.push(this.makeToken(TokenType.LBRACKET, '[', lineNum, i, i + 1));
        i++;
        continue;
      }
      if (line[i] === ']') {
        tokens.push(this.makeToken(TokenType.RBRACKET, ']', lineNum, i, i + 1));
        i++;
        continue;
      }
      if (line[i] === '-' && (i + 1 < line.length && /[0-9]/.test(line[i + 1]))) {
        // Negative number — handled by decimal match above, but skip if not matched
      }

      // Primitive types: i8, i16, etc.
      const typeMatch = line.substring(i).match(/^(i8|i16|i32|i64|u8|u16|u32|u64|f32|f64|bool|void)\b/);
      if (typeMatch) {
        tokens.push(this.makeToken(TokenType.TYPE_PRIMITIVE, typeMatch[1], lineNum, i, i + typeMatch[1].length));
        i += typeMatch[1].length;
        continue;
      }

      // Identifier (catch-all for unknown words)
      const identMatch = line.substring(i).match(/^[a-zA-Z_]\w*/);
      if (identMatch) {
        tokens.push(this.makeToken(TokenType.IDENTIFIER, identMatch[0], lineNum, i, i + identMatch[0].length));
        i += identMatch[0].length;
        continue;
      }

      // Unknown character — skip
      i++;
    }

    return tokens;
  }

  /** Create a token at a specific position */
  private makeToken(type: TokenType, value: string, line: number, startChar: number, endChar: number): Token {
    return {
      type,
      value,
      range: {
        start: { line, character: startChar },
        end: { line, character: endChar },
      },
      line,
      offset: startChar,
    };
  }

  /** Get the current code block dialect (for context-aware completion) */
  getCodeBlockDialect(): string {
    return this.state.codeBlockDialect;
  }

  /** Check if we're inside a code block */
  isInCodeBlock(): boolean {
    return this.state.inCodeBlock;
  }
}
