/**
 * types.ts — Core type definitions for the FLUX Language Server
 *
 * WHY: The grammar-spec.md defines 12 AST node types (Appendix A), 18 token types
 * (Appendix B), and 7 section types. These types form the contract between the
 * lexer, parser, and LSP providers. Every downstream feature (completion, hover,
 * diagnostics, go-to-definition) depends on these interfaces being correct.
 *
 * DECISION: We represent the AST as a discriminated union (FluxNode) rather than
 * a class hierarchy. Rationale: (1) discriminated unions enable exhaustive pattern
 * matching in TypeScript, (2) they serialize cleanly to JSON for debugging, (3)
 * the LSP protocol already uses discriminated unions extensively, so this aligns
 * with the ecosystem. Tradeoff: no methods on nodes — all behavior lives in
 * visitor-style functions on the analyzer/provider layer.
 *
 * TIMESTAMP: 2026-04-12T02:00:00Z — Session 8, initial scaffolding
 */

/** Position in a source file (0-indexed) */
export interface Position {
  line: number;
  character: number;
}

/** Range between two positions */
export interface Range {
  start: Position;
  end: Position;
}

/** Source span for error reporting and hover documentation */
export interface SourceSpan {
  range: Range;
  source: string; // the actual text covered
}

// ─── Token Types (from grammar-spec.md Appendix B) ───

export enum TokenType {
  // Structure
  FRONTMATTER_OPEN = 'FRONTMATTER_OPEN',
  FRONTMATTER_CLOSE = 'FRONTMATTER_CLOSE',
  SECTION_HEADING = 'SECTION_HEADING',
  MARKDOWN_HEADING = 'MARKDOWN_HEADING',
  DIRECTIVE = 'DIRECTIVE',
  CODE_FENCE_OPEN = 'CODE_FENCE_OPEN',
  CODE_FENCE_CLOSE = 'CODE_FENCE_CLOSE',

  // Assembly tokens
  LABEL = 'LABEL',
  MNEMONIC = 'MNEMONIC',
  GP_REGISTER = 'GP_REGISTER',
  FP_REGISTER = 'FP_REGISTER',
  VEC_REGISTER = 'VEC_REGISTER',
  SPECIAL_REGISTER = 'SPECIAL_REGISTER',
  IMM_DECIMAL = 'IMM_DECIMAL',
  IMM_HEX = 'IMM_HEX',
  IMM_BINARY = 'IMM_BINARY',
  STRING_LITERAL = 'STRING_LITERAL',
  LINE_COMMENT = 'LINE_COMMENT',
  HASH_COMMENT = 'HASH_COMMENT',

  // Type tokens
  TYPE_PRIMITIVE = 'TYPE_PRIMITIVE',
  ARROW = 'ARROW',
  COLON = 'COLON',
  COMMA = 'COMMA',
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  LBRACKET = 'LBRACKET',
  RBRACKET = 'RBRACKET',
  SEMICOLON = 'SEMICOLON',
  AT = 'AT',
  UNDERSCORE = 'UNDERSCORE',

  // Literals and identifiers
  IDENTIFIER = 'IDENTIFIER',
  WHITESPACE = 'WHITESPACE',
  NEWLINE = 'NEWLINE',
  TEXT = 'TEXT',
  EOF = 'EOF',
}

/** A single lexed token */
export interface Token {
  type: TokenType;
  value: string;
  range: Range;
  line: number;
  offset: number; // character offset within the line
}

// ─── AST Node Types (from grammar-spec.md Appendix A) ───

export enum SectionType {
  FN = 'fn',
  AGENT = 'agent',
  TILE = 'tile',
  REGION = 'region',
  VOCABULARY = 'vocabulary',
  TEST = 'test',
}

export enum DirectiveKey {
  CAPABILITY = 'capability',
  IMPORT = 'import',
  EXPORT = 'export',
  DEPRECATED = 'deprecated',
  EXPERIMENTAL = 'experimental',
  REQUIRE = 'require',
  FEATURE = 'feature',
  OPTIMIZE = 'optimize',
  UNSAFE = 'unsafe',
  TEST = 'test',
  BENCH = 'bench',
}

export enum CodeBlockDialect {
  FLUX = 'flux',           // compiled to bytecode
  FLUXFN = 'fluxfn',       // function-level FLUX
  FLUX_TYPE = 'flux-type', // type definitions
  FIR = 'fir',             // FIR IR
  FLUXVOCAB = 'fluxvocab', // vocabulary definitions
  JSON = 'json',           // data block
  YAML = 'yaml',           // data block
  NATIVE = 'native',       // any other language
}

/** Function parameter with name and type */
export interface FnParam {
  name: string;
  typeExpr: string;
  span: SourceSpan;
}

/** Function signature: name(params) -> returnType */
export interface FnSignature {
  name: string;
  params: FnParam[];
  returnType: string | null;
  flags: string[];
  span: SourceSpan;
}

// ─── AST Node Discriminated Union ───

export enum NodeType {
  FLUX_MODULE = 'FluxModule',
  FRONTMATTER = 'Frontmatter',
  SECTION_HEADING = 'SectionHeading',
  DIRECTIVE_NODE = 'DirectiveNode',
  PARAGRAPH = 'Paragraph',
  CODE_BLOCK = 'CodeBlock',
  FLUX_CODE_BLOCK = 'FluxCodeBlock',
  DATA_BLOCK = 'DataBlock',
  NATIVE_BLOCK = 'NativeBlock',
  LIST_BLOCK = 'ListBlock',
  LIST_ITEM = 'ListItem',
  INSTRUCTION = 'Instruction',
  LABEL_DEF = 'LabelDef',
}

export interface FluxModule {
  type: NodeType.FLUX_MODULE;
  uri: string;
  frontmatter: Map<string, string> | null;
  children: FluxNode[];
  range: Range;
}

export interface FrontmatterNode {
  type: NodeType.FRONTMATTER;
  fields: Map<string, string>;
  range: Range;
}

export interface SectionHeadingNode {
  type: NodeType.SECTION_HEADING;
  sectionType: SectionType;
  name: string;
  signature: FnSignature | null;
  flags: string[];
  range: Range;
  nameSpan: SourceSpan;
}

export interface DirectiveNode {
  type: NodeType.DIRECTIVE_NODE;
  key: DirectiveKey;
  value: string;
  rawKey: string; // in case of custom directives
  range: Range;
}

export interface ParagraphNode {
  type: NodeType.PARAGRAPH;
  text: string;
  range: Range;
}

export interface CodeBlockNode {
  type: NodeType.CODE_BLOCK;
  dialect: CodeBlockDialect;
  rawDialect: string;
  content: string;
  meta: string;
  range: Range;
  contentRange: Range;
}

export interface InstructionNode {
  type: NodeType.INSTRUCTION;
  mnemonic: string;
  operands: string[];
  comment: string | null;
  label: string | null;
  range: Range;
  mnemonicSpan: SourceSpan;
}

export interface LabelDefNode {
  type: NodeType.LABEL_DEF;
  name: string;
  range: Range;
  span: SourceSpan;
}

export interface ListBlockNode {
  type: NodeType.LIST_BLOCK;
  ordered: boolean;
  items: string[];
  range: Range;
}

export type FluxNode =
  | FluxModule
  | FrontmatterNode
  | SectionHeadingNode
  | DirectiveNode
  | ParagraphNode
  | CodeBlockNode
  | InstructionNode
  | LabelDefNode
  | ListBlockNode;

// ─── Semantic Analysis Types ───

/** A resolved definition that can be referenced */
export interface SymbolDef {
  name: string;
  kind: 'fn' | 'agent' | 'tile' | 'region' | 'vocabulary' | 'test' | 'label';
  node: FluxNode;
  range: Range;
  containerRange?: Range; // for labels, the code block they're in
  uri: string;
}

/** A symbol reference in code */
export interface SymbolRef {
  name: string;
  kind: 'call' | 'jump' | 'import' | 'export' | 'usage';
  node: FluxNode;
  range: Range;
  uri: string;
}

/** Diagnostic severity */
export enum FluxDiagnosticSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
}

/** A diagnostic for a .flux.md file */
export interface FluxDiagnostic {
  severity: FluxDiagnosticSeverity;
  message: string;
  range: Range;
  code?: string;
  source?: string;
}
