/**
 * parser.test.ts — Unit tests for the FLUX parser
 */

import { Parser } from '../src/parser';
import { NodeType, SectionType, CodeBlockDialect } from '../src/types';

describe('Parser', () => {
  describe('frontmatter', () => {
    it('should parse YAML frontmatter fields', () => {
      const parser = new Parser('---\ntitle: Test\ndescription: A module\n---\n');
      const ast = parser.parse();

      expect(ast.frontmatter).not.toBeNull();
      expect(ast.frontmatter!.get('title')).toBe('Test');
      expect(ast.frontmatter!.get('description')).toBe('A module');
    });

    it('should handle documents without frontmatter', () => {
      const parser = new Parser('# Hello\n');
      const ast = parser.parse();
      expect(ast.frontmatter).toBeNull();
    });
  });

  describe('section headings', () => {
    it('should parse ## fn: headings with signatures', () => {
      const parser = new Parser('## fn: add(a: i32, b: i32) -> i32\nSome docs\n');
      const ast = parser.parse();

      const heading = ast.children.find(c => c.type === NodeType.SECTION_HEADING);
      expect(heading).toBeDefined();
      expect((heading as any).sectionType).toBe(SectionType.FN);
      expect((heading as any).name).toBe('add');
      expect((heading as any).signature).not.toBeNull();
      expect((heading as any).signature.params.length).toBe(2);
    });

    it('should parse ## agent: headings', () => {
      const parser = new Parser('## agent: calculator\nDocs\n');
      const ast = parser.parse();

      const heading = ast.children.find(c => c.type === NodeType.SECTION_HEADING);
      expect(heading).toBeDefined();
      expect((heading as any).sectionType).toBe(SectionType.AGENT);
      expect((heading as any).name).toBe('calculator');
    });

    it('should parse ## tile: headings', () => {
      const parser = new Parser('## tile: matmul\nDocs\n');
      const ast = parser.parse();

      const heading = ast.children.find(c => c.type === NodeType.SECTION_HEADING);
      expect((heading as any).sectionType).toBe(SectionType.TILE);
    });

    it('should parse ## region: headings', () => {
      const parser = new Parser('## region: workspace\nDocs\n');
      const ast = parser.parse();

      const heading = ast.children.find(c => c.type === NodeType.SECTION_HEADING);
      expect((heading as any).sectionType).toBe(SectionType.REGION);
    });

    it('should parse ## vocabulary: headings', () => {
      const parser = new Parser('## vocabulary: core_actions\nDocs\n');
      const ast = parser.parse();

      const heading = ast.children.find(c => c.type === NodeType.SECTION_HEADING);
      expect((heading as any).sectionType).toBe(SectionType.VOCABULARY);
    });

    it('should parse ## test: headings', () => {
      const parser = new Parser('## test: add_test\nDocs\n');
      const ast = parser.parse();

      const heading = ast.children.find(c => c.type === NodeType.SECTION_HEADING);
      expect((heading as any).sectionType).toBe(SectionType.TEST);
    });
  });

  describe('code blocks', () => {
    it('should parse flux code blocks', () => {
      const parser = new Parser('```flux\nMOVI R0, 42\nHALT\n```\n');
      const ast = parser.parse();

      const codeBlock = ast.children.find(c => c.type === NodeType.CODE_BLOCK);
      expect(codeBlock).toBeDefined();
      expect((codeBlock as any).dialect).toBe(CodeBlockDialect.FLUX);
      expect((codeBlock as any).content).toContain('MOVI R0, 42');
    });

    it('should parse FIR code blocks', () => {
      const parser = new Parser('```fir\nfunction test() {\n}\n```\n');
      const ast = parser.parse();

      const codeBlock = ast.children.find(c => c.type === NodeType.CODE_BLOCK);
      expect(codeBlock).toBeDefined();
      expect((codeBlock as any).dialect).toBe(CodeBlockDialect.FIR);
    });

    it('should parse fluxvocab code blocks', () => {
      const parser = new Parser('```fluxvocab\n:double\n  ADD R0, R0, R0\n```\n');
      const ast = parser.parse();

      const codeBlock = ast.children.find(c => c.type === NodeType.CODE_BLOCK);
      expect(codeBlock).toBeDefined();
      expect((codeBlock as any).dialect).toBe(CodeBlockDialect.FLUXVOCAB);
    });
  });

  describe('directives', () => {
    it('should parse #!capability directives', () => {
      const parser = new Parser('#!capability arithmetic\n');
      const ast = parser.parse();

      const directive = ast.children.find(c => c.type === NodeType.DIRECTIVE_NODE);
      expect(directive).toBeDefined();
      expect((directive as any).key).toBe('capability');
      expect((directive as any).value).toBe('arithmetic');
    });

    it('should parse #!import directives', () => {
      const parser = new Parser('#!import core.math\n');
      const ast = parser.parse();

      const directive = ast.children.find(c => c.type === NodeType.DIRECTIVE_NODE);
      expect(directive).toBeDefined();
      expect((directive as any).value).toBe('core.math');
    });
  });

  describe('instructions', () => {
    it('should parse instructions from flux code blocks', () => {
      const parser = new Parser('```flux\nMOVI R0, 42\nADD R0, R0, R1\nHALT\n```\n');
      const ast = parser.parse();

      const instructions = ast.children.filter(c => c.type === NodeType.INSTRUCTION);
      expect(instructions.length).toBe(3);

      expect((instructions[0] as any).mnemonic).toBe('MOVI');
      expect((instructions[0] as any).operands).toContain('R0');
      expect((instructions[0] as any).operands).toContain('42');
    });

    it('should parse labels from code blocks', () => {
      const parser = new Parser('```flux\n@loop:\nADD R0, R0, R1\nJMP @loop\n```\n');
      const ast = parser.parse();

      const labels = ast.children.filter(c => c.type === NodeType.LABEL_DEF);
      expect(labels.length).toBe(1);
      expect((labels[0] as any).name).toBe('loop');
    });
  });

  describe('full documents', () => {
    it('should parse a complete module document', () => {
      const doc = `---
title: Fibonacci Module
version: 1.0
tiles: [math]
---

# Fibonacci Module

#!import core.memory
#!capability arithmetic
#!export fibonacci

## region: memo_table
Memoization table.

- **Size**: 1024 bytes
- **Access**: read/write

\`\`\`flux
REGION_CREATE R0, 1024
MOV R12, R0
\`\`\`

## fn: fibonacci(n: i32) -> i32
Compute the nth Fibonacci number.

\`\`\`flux
; Input: R0 = n
CMP_EQ R3, R0, 0
JNZ R3, @base_zero

@recurse:
  PUSH R0
  DEC R0
  CALL fibonacci
  POP R0
  RET

@base_zero:
  MOVI R0, 0
  RET
\`\`\`

## test: fib_test_10
Verify fibonacci(10) = 55.

\`\`\`flux
MOVI R0, 10
CALL fibonacci
MOVI R1, 55
CMP_EQ R2, R0, R1
ASSERT
\`\`\`
`;
      const parser = new Parser(doc);
      const ast = parser.parse();

      // Verify structure
      expect(ast.frontmatter).not.toBeNull();
      expect(ast.frontmatter!.get('title')).toBe('Fibonacci Module');

      const sections = ast.children.filter(c => c.type === NodeType.SECTION_HEADING);
      expect(sections.length).toBe(3); // region, fn, test

      const directives = ast.children.filter(c => c.type === NodeType.DIRECTIVE_NODE);
      expect(directives.length).toBe(3); // import, capability, export

      const codeBlocks = ast.children.filter(c => c.type === NodeType.CODE_BLOCK);
      expect(codeBlocks.length).toBeGreaterThanOrEqual(3); // region, fn, test (possibly more from sections)

      const instructions = ast.children.filter(c => c.type === NodeType.INSTRUCTION);
      expect(instructions.length).toBeGreaterThanOrEqual(8);

      const labels = ast.children.filter(c => c.type === NodeType.LABEL_DEF);
      expect(labels.length).toBe(2); // @recurse, @base_zero
    });
  });
});
