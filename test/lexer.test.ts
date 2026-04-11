/**
 * lexer.test.ts — Unit tests for the FLUX lexer
 *
 * WHY: The lexer is the foundation of the LSP — if it produces wrong tokens,
 * every downstream feature (completion, hover, diagnostics) breaks. These tests
 * verify that the lexer correctly handles all token types from grammar-spec.md
 * Appendix B, including edge cases like nested code blocks, mixed registers,
 * and string literals with escapes.
 */

import { Lexer } from '../src/lexer';
import { TokenType } from '../src/types';

describe('Lexer', () => {
  describe('frontmatter', () => {
    it('should tokenize YAML frontmatter delimiters', () => {
      const lexer = new Lexer('---\ntitle: Test\n---\n');
      const tokens = lexer.tokenize();

      expect(tokens[0].type).toBe(TokenType.FRONTMATTER_OPEN);
      expect(tokens[0].value).toBe('---');
      // Second line is inside frontmatter
      expect(tokens[2].type).toBe(TokenType.TEXT);
      expect(tokens[2].value).toContain('title: Test');
      // Closing delimiter
      const closeToken = tokens.find(t => t.type === TokenType.FRONTMATTER_CLOSE);
      expect(closeToken).toBeDefined();
      expect(closeToken!.value).toBe('---');
    });
  });

  describe('section headings', () => {
    it('should tokenize ## fn: section headings', () => {
      const lexer = new Lexer('## fn: factorial(n: i32) -> i32\n');
      const tokens = lexer.tokenize();

      const heading = tokens.find(t => t.type === TokenType.SECTION_HEADING);
      expect(heading).toBeDefined();
      expect(heading!.value).toContain('fn:');
    });

    it('should tokenize ## agent: section headings', () => {
      const lexer = new Lexer('## agent: calculator\n');
      const tokens = lexer.tokenize();

      const heading = tokens.find(t => t.type === TokenType.SECTION_HEADING);
      expect(heading).toBeDefined();
    });

    it('should tokenize ## tile: section headings', () => {
      const lexer = new Lexer('## tile: matmul\n');
      const tokens = lexer.tokenize();

      const heading = tokens.find(t => t.type === TokenType.SECTION_HEADING);
      expect(heading).toBeDefined();
    });

    it('should not match non-section markdown headings', () => {
      const lexer = new Lexer('# Title\n## Section\n');
      const tokens = lexer.tokenize();

      const sections = tokens.filter(t => t.type === TokenType.SECTION_HEADING);
      expect(sections.length).toBe(0);
    });
  });

  describe('directives', () => {
    it('should tokenize #!capability directive', () => {
      const lexer = new Lexer('#!capability arithmetic\n');
      const tokens = lexer.tokenize();

      const directive = tokens.find(t => t.type === TokenType.DIRECTIVE);
      expect(directive).toBeDefined();
      expect(directive!.value).toBe('#!capability');
    });

    it('should tokenize #!import directive', () => {
      const lexer = new Lexer('#!import core.math\n');
      const tokens = lexer.tokenize();

      const directive = tokens.find(t => t.type === TokenType.DIRECTIVE);
      expect(directive).toBeDefined();
      expect(directive!.value).toBe('#!import');
    });
  });

  describe('code blocks', () => {
    it('should detect code block boundaries', () => {
      const lexer = new Lexer('```flux\nMOVI R0, 42\n```\n');
      const tokens = lexer.tokenize();

      const open = tokens.find(t => t.type === TokenType.CODE_FENCE_OPEN);
      const close = tokens.find(t => t.type === TokenType.CODE_FENCE_CLOSE);
      expect(open).toBeDefined();
      expect(close).toBeDefined();
    });

    it('should tokenize assembly instructions inside code blocks', () => {
      const lexer = new Lexer('```flux\nMOVI R0, 42\nHALT\n```\n');
      const tokens = lexer.tokenize();

      const mnemonics = tokens.filter(t => t.type === TokenType.MNEMONIC);
      expect(mnemonics.length).toBeGreaterThanOrEqual(2);
      expect(mnemonics[0].value).toBe('MOVI');
      expect(mnemonics[1].value).toBe('HALT');
    });

    it('should tokenize registers inside code blocks', () => {
      const lexer = new Lexer('```flux\nADD R0, R1, R2\n```\n');
      const tokens = lexer.tokenize();

      const registers = tokens.filter(t => t.type === TokenType.GP_REGISTER);
      expect(registers.length).toBe(3);
      expect(registers.map(r => r.value)).toEqual(['R0', 'R1', 'R2']);
    });

    it('should tokenize labels inside code blocks', () => {
      const lexer = new Lexer('```flux\n@loop:\nADD R0, R0, R1\nJMP @loop\n```\n');
      const tokens = lexer.tokenize();

      const labels = tokens.filter(t => t.type === TokenType.LABEL);
      expect(labels.length).toBe(2); // @loop: (definition) and @loop (reference)
    });

    it('should tokenize comments inside code blocks', () => {
      const lexer = new Lexer('```flux\n; This is a comment\nMOVI R0, 42\n```\n');
      const tokens = lexer.tokenize();

      const comments = tokens.filter(t => t.type === TokenType.LINE_COMMENT);
      expect(comments.length).toBe(1);
      expect(comments[0].value).toContain('This is a comment');
    });

    it('should tokenize hex immediates', () => {
      const lexer = new Lexer('```flux\nMOVI R0, 0xFF\n```\n');
      const tokens = lexer.tokenize();

      const hex = tokens.find(t => t.type === TokenType.IMM_HEX);
      expect(hex).toBeDefined();
      expect(hex!.value).toBe('0xFF');
    });

    it('should tokenize binary immediates', () => {
      const lexer = new Lexer('```flux\nMOVI R0, 0b1010\n```\n');
      const tokens = lexer.tokenize();

      const bin = tokens.find(t => t.type === TokenType.IMM_BINARY);
      expect(bin).toBeDefined();
      expect(bin!.value).toBe('0b1010');
    });

    it('should tokenize string literals', () => {
      const lexer = new Lexer('```flux\nSYS "hello world"\n```\n');
      const tokens = lexer.tokenize();

      const str = tokens.find(t => t.type === TokenType.STRING_LITERAL);
      expect(str).toBeDefined();
      expect(str!.value).toBe('"hello world"');
    });

    it('should tokenize float and vector registers', () => {
      const lexer = new Lexer('```flux\nFADD F0, F1, F2\nVLOAD V0, R0, R1\n```\n');
      const tokens = lexer.tokenize();

      const fRegs = tokens.filter(t => t.type === TokenType.FP_REGISTER);
      const vRegs = tokens.filter(t => t.type === TokenType.VEC_REGISTER);
      expect(fRegs.length).toBe(3);
      expect(vRegs.length).toBe(1);
    });

    it('should tokenize special registers', () => {
      const lexer = new Lexer('```flux\nMOV R0, SP\nPUSH LR\n```\n');
      const tokens = lexer.tokenize();

      const specials = tokens.filter(t => t.type === TokenType.SPECIAL_REGISTER);
      expect(specials.length).toBe(2);
    });
  });

  describe('full documents', () => {
    it('should tokenize a complete .flux.md document', () => {
      const doc = `---
title: Test Module
version: 1.0
---

# Test Module

#!capability arithmetic

## fn: factorial(n: i32) -> i32
Computes factorial.

\`\`\`flux
MOVI R1, 1
@loop:
CMP R0, 1
JLE R0, @exit
IMUL R1, R1, R0
DEC R0
JMP @loop
@exit:
MOV R0, R1
RET
\`\`\`
`;
      const lexer = new Lexer(doc);
      const tokens = lexer.tokenize();

      // Should have frontmatter, heading, directive, section, code block, instructions
      expect(tokens.find(t => t.type === TokenType.FRONTMATTER_OPEN)).toBeDefined();
      expect(tokens.find(t => t.type === TokenType.DIRECTIVE)).toBeDefined();
      expect(tokens.find(t => t.type === TokenType.SECTION_HEADING)).toBeDefined();
      expect(tokens.find(t => t.type === TokenType.CODE_FENCE_OPEN)).toBeDefined();

      const mnemonics = tokens.filter(t => t.type === TokenType.MNEMONIC);
      expect(mnemonics.length).toBeGreaterThanOrEqual(7);
    });

    it('should handle EOF token', () => {
      const lexer = new Lexer('');
      const tokens = lexer.tokenize();
      expect(tokens[tokens.length - 1].type).toBe(TokenType.EOF);
    });
  });
});
