/**
 * Tests for LSP Completion features in FluxLanguageServer
 */

import { TextDocument } from 'vscode-languageserver-textdocument';
import { FluxLanguageServer } from '../server';
import { Position, Range } from 'vscode-languageserver';

// ─── Mock Connection ────────────────────────────────────────────────────────

class MockConnection {
    public diagnostics: Map<string, any[]> = new Map();
    public logs: string[] = [];

    console = {
        info: (msg: string) => { this.logs.push(msg); },
        error: (msg: string) => { this.logs.push(`ERROR: ${msg}`); },
        warn: (msg: string) => { this.logs.push(`WARN: ${msg}`); },
        log: (msg: string) => { this.logs.push(msg); },
    };

    sendDiagnostics(params: { uri: string; diagnostics: any[] }) {
        this.diagnostics.set(params.uri, params.diagnostics);
    }

    languages = {
        foldingRange: {
            on: () => {},
        },
        semanticTokens: {
            on: () => {},
        },
        prepareRename: {
            on: () => {},
        },
    };

    onCompletion = () => {};
    onCompletionResolve = () => {};
    onHover = () => {};
    onDefinition = () => {};
    onDocumentSymbol = () => {};
    onReferences = () => {};
    onSignatureHelp = () => {};
    onWorkspaceSymbol = () => {};
    onRename = () => {};
}

const URI = 'file:///test.flux';

function createServer(source: string): FluxLanguageServer {
    const connection = new MockConnection() as any;
    const documents = {
        get: (docUri: string) => {
            if (docUri === URI) {
                return TextDocument.create(URI, 'flux', 0, source);
            }
            return undefined;
        },
        onDidChangeContent: () => {},
        onDidOpen: () => {},
        onDidClose: () => {},
        listen: () => {},
    } as any;

    const server = new FluxLanguageServer(connection, documents);
    return server;
}

// ─── Completion: Opcode position ────────────────────────────────────────────

describe('FluxLanguageServer - onCompletion', () => {
    test('returns opcodes at start of line', async () => {
        const server = createServer('\n');
        server.registerHandlers();
        // Pre-populate cache
        const doc = TextDocument.create(URI, 'flux', 0, '');
        server.validateDocument(doc);

        const items = await (server as any).onCompletion({
            textDocument: { uri: URI },
            position: { line: 0, character: 0 },
        });

        expect(items.length).toBeGreaterThan(200);
        const labels = items.map((i: any) => i.label);
        expect(labels).toContain('HALT');
        expect(labels).toContain('ADD');
        expect(labels).toContain('MOVI');
    });

    test('returns registers at operand position', async () => {
        const source = 'ADD R0, R1, R2\n';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        // Cursor at position 4 is inside "R0" (operand position)
        const items = await (server as any).onCompletion({
            textDocument: { uri: URI },
            position: { line: 0, character: 4 },
        });

        const labels = items.map((i: any) => i.label);
        // At operand position we get registers and labels, not opcodes
        expect(labels).toContain('R0');
        expect(labels).toContain('R1');
        expect(labels).toContain('R15');
        expect(labels).toContain('SP');
    });

    test('returns label completions when @ is typed', async () => {
        const source = '@start:\n@loop:\n  JMP @';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        // Cursor at the @ in "JMP @"
        const items = await (server as any).onCompletion({
            textDocument: { uri: URI },
            position: { line: 2, character: 7 },
            context: { triggerKind: 1, triggerCharacter: '@' },
        });

        const labels = items.map((i: any) => i.label);
        expect(labels).toContain('@start');
        expect(labels).toContain('@loop');
    });

    test('returns directives when . is typed', async () => {
        const source = '\n.text';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const items = await (server as any).onCompletion({
            textDocument: { uri: URI },
            position: { line: 0, character: 0 },
            context: { triggerKind: 1, triggerCharacter: '.' },
        });

        expect(items.length).toBeGreaterThan(0);
        const labels = items.map((i: any) => i.label);
        expect(labels.some((l: string) => l.startsWith('.'))).toBe(true);
    });

    test('returns empty array for unknown document', async () => {
        const server = createServer('');
        const items = await (server as any).onCompletion({
            textDocument: { uri: 'file:///unknown.flux' },
            position: { line: 0, character: 0 },
        });
        expect(items).toEqual([]);
    });

    test('includes registers in opcode position completions', async () => {
        const server = createServer('');
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, '');
        server.validateDocument(doc);

        const items = await (server as any).onCompletion({
            textDocument: { uri: URI },
            position: { line: 0, character: 0 },
        });

        const labels = items.map((i: any) => i.label);
        expect(labels).toContain('R0');
        expect(labels).toContain('R15');
        expect(labels).toContain('F0');
        expect(labels).toContain('V0');
        expect(labels).toContain('SP');
        expect(labels).toContain('FLAGS');
    });

    test('includes labels in opcode position completions', async () => {
        const source = '@my_func:\n  HALT\n';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const items = await (server as any).onCompletion({
            textDocument: { uri: URI },
            position: { line: 1, character: 2 },  // Inside "HALT"
        });

        const labels = items.map((i: any) => i.label);
        // Registers + label refs in operand position
        expect(labels).toContain('@my_func');
    });
});

// ─── Completion Resolve ─────────────────────────────────────────────────────

describe('FluxLanguageServer - onCompletionResolve', () => {
    test('resolves opcode completion with documentation', async () => {
        const server = createServer('');
        server.registerHandlers();

        const item: any = { label: 'ADD' };
        const resolved = await (server as any).onCompletionResolve(item);

        expect(resolved.documentation).toBeDefined();
        // documentation is a string (Markdown), not MarkupContent
        expect(typeof resolved.documentation).toBe('string');
        expect(resolved.documentation).toContain('ADD');
        expect(resolved.documentation).toContain('rs1 + rs2');
    });

    test('does not add documentation for unknown items', async () => {
        const server = createServer('');
        server.registerHandlers();

        const item: any = { label: 'FAKEOP' };
        const resolved = await (server as any).onCompletionResolve(item);

        expect(resolved.documentation).toBeUndefined();
    });

    test('resolves zero-operand opcode', async () => {
        const server = createServer('');
        server.registerHandlers();

        const item: any = { label: 'HALT' };
        const resolved = await (server as any).onCompletionResolve(item);

        expect(resolved.documentation).toContain('HALT');
        expect(resolved.documentation).toContain('Stop execution');
    });
});

// ─── Hover ──────────────────────────────────────────────────────────────────

describe('FluxLanguageServer - onHover', () => {
    test('hovers on opcode mnemonic', async () => {
        const source = 'ADD R0, R1, R2';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onHover({
            textDocument: { uri: URI },
            position: { line: 0, character: 1 }, // On 'ADD'
        });

        expect(result).not.toBeNull();
        expect(result.contents.value).toContain('ADD');
        expect(result.contents.value).toContain('rs1 + rs2');
    });

    test('hovers on HALT', async () => {
        const source = 'HALT';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onHover({
            textDocument: { uri: URI },
            position: { line: 0, character: 1 },
        });

        expect(result).not.toBeNull();
        expect(result.contents.value).toContain('Stop execution');
    });

    test('hovers on GP register', async () => {
        const source = 'ADD R0, R1, R2';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        // Hover on R0
        const result = await (server as any).onHover({
            textDocument: { uri: URI },
            position: { line: 0, character: 5 },
        });

        expect(result).not.toBeNull();
        expect(result.contents.value).toContain('R0');
        expect(result.contents.value).toContain('General-purpose');
    });

    test('hovers on SP register alias', async () => {
        const source = 'PUSH SP';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onHover({
            textDocument: { uri: URI },
            position: { line: 0, character: 6 },
        });

        expect(result).not.toBeNull();
        expect(result.contents.value).toContain('SP');
        expect(result.contents.value).toContain('Stack Pointer');
    });

    test('hovers on LR register alias', async () => {
        const source = 'PUSH LR';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onHover({
            textDocument: { uri: URI },
            position: { line: 0, character: 6 },
        });

        expect(result).not.toBeNull();
        expect(result.contents.value).toContain('Link Register');
    });

    test('hovers on FP register alias', async () => {
        const source = 'PUSH FP';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onHover({
            textDocument: { uri: URI },
            position: { line: 0, character: 6 },
        });

        expect(result).not.toBeNull();
        expect(result.contents.value).toContain('Frame Pointer');
    });

    test('hovers on FLAGS register', async () => {
        const source = 'CLF FLAGS';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onHover({
            textDocument: { uri: URI },
            position: { line: 0, character: 5 },
        });

        expect(result).not.toBeNull();
        expect(result.contents.value).toContain('FLAGS');
        expect(result.contents.value).toContain('Status Flags');
    });

    test('hovers on floating-point register', async () => {
        const source = 'FADD F0, F1, F2';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onHover({
            textDocument: { uri: URI },
            position: { line: 0, character: 6 },
        });

        expect(result).not.toBeNull();
        expect(result.contents.value).toContain('F0');
        expect(result.contents.value).toContain('Floating-point');
    });

    test('hovers on vector register', async () => {
        const source = 'VADD V0, V1, V2';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onHover({
            textDocument: { uri: URI },
            position: { line: 0, character: 6 },
        });

        expect(result).not.toBeNull();
        expect(result.contents.value).toContain('V0');
        expect(result.contents.value).toContain('SIMD');
    });

    test('hovers on defined label reference', async () => {
        const source = '@loop:\n  JMP @loop';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onHover({
            textDocument: { uri: URI },
            position: { line: 1, character: 7 }, // On @loop
        });

        expect(result).not.toBeNull();
        expect(result.contents.value).toContain('@loop');
        expect(result.contents.value).toContain('Defined at line');
    });

    test('returns null for undefined label reference hover', async () => {
        const source = 'JMP @unknown';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onHover({
            textDocument: { uri: URI },
            position: { line: 0, character: 5 },
        });

        expect(result).toBeNull();
    });

    test('hovers on label definition', async () => {
        const source = '@my_label:\n  HALT';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onHover({
            textDocument: { uri: URI },
            position: { line: 0, character: 1 }, // On @my_label
        });

        expect(result).not.toBeNull();
        expect(result.contents.value).toContain('@my_label');
        expect(result.contents.value).toContain('Defined at line');
    });

    test('hovers on directive', async () => {
        const source = '.text';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onHover({
            textDocument: { uri: URI },
            position: { line: 0, character: 1 }, // On .text
        });

        expect(result).not.toBeNull();
        expect(result.contents.value).toContain('.text');
        expect(result.contents.value).toContain('directive');
    });

    test('returns null for unknown document', async () => {
        const server = createServer('');
        const result = await (server as any).onHover({
            textDocument: { uri: 'file:///unknown.flux' },
            position: { line: 0, character: 0 },
        });
        expect(result).toBeNull();
    });

    test('returns null when no word at position', async () => {
        const source = '  ;  ';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onHover({
            textDocument: { uri: URI },
            position: { line: 0, character: 0 },
        });

        expect(result).toBeNull();
    });
});

// ─── Go-to-Definition ───────────────────────────────────────────────────────

describe('FluxLanguageServer - onDefinition', () => {
    test('navigates to label definition from reference', async () => {
        const source = '@start:\n  MOVI R0, 42\n  JMP @start';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onDefinition({
            textDocument: { uri: URI },
            position: { line: 2, character: 7 }, // On @start
        });

        expect(result).not.toBeNull();
        expect(result.uri).toBe(URI);
        expect(result.range.start.line).toBe(0);
    });

    test('returns null for undefined label', async () => {
        const source = 'JMP @unknown';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onDefinition({
            textDocument: { uri: URI },
            position: { line: 0, character: 5 },
        });

        expect(result).toBeNull();
    });

    test('navigates to label on opcode line', async () => {
        const source = '@done: HALT\n  JMP @done';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onDefinition({
            textDocument: { uri: URI },
            position: { line: 1, character: 7 }, // On @done
        });

        expect(result).not.toBeNull();
        expect(result.range.start.line).toBe(0);
    });

    test('returns null for non-label word', async () => {
        const source = 'ADD R0, R1, R2';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onDefinition({
            textDocument: { uri: URI },
            position: { line: 0, character: 1 }, // On ADD
        });

        // ADD is not a label reference, so no definition
        expect(result).toBeNull();
    });

    test('navigates to section definition', async () => {
        const source = '## fn: my_func\n  HALT\n#!import my_func';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onDefinition({
            textDocument: { uri: URI },
            position: { line: 2, character: 10 }, // On my_func in #!import
        });

        expect(result).not.toBeNull();
        expect(result.range.start.line).toBe(0);
    });

    test('returns null for unknown document', async () => {
        const server = createServer('');
        const result = await (server as any).onDefinition({
            textDocument: { uri: 'file:///unknown.flux' },
            position: { line: 0, character: 0 },
        });
        expect(result).toBeNull();
    });
});

// ─── Find References ────────────────────────────────────────────────────────

describe('FluxLanguageServer - onReferences', () => {
    test('finds all references to a label', async () => {
        const source = '@loop:\n  ADD R0, R1, R2\n  JMP @loop\n  JNZ R0, @loop';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onReferences({
            textDocument: { uri: URI },
            position: { line: 0, character: 1 }, // On @loop definition
            context: { includeDeclaration: false },
        });

        expect(result).toHaveLength(2);
        expect(result[0].range.start.line).toBe(2);
        expect(result[1].range.start.line).toBe(3);
    });

    test('includes declaration when includeDeclaration is true', async () => {
        const source = '@target:\n  JMP @target';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onReferences({
            textDocument: { uri: URI },
            position: { line: 0, character: 1 },
            context: { includeDeclaration: true },
        });

        expect(result.length).toBeGreaterThanOrEqual(2);
        // First should be the definition
        expect(result[0].range.start.line).toBe(0);
    });

    test('returns empty for label with no references', async () => {
        const source = '@unused:\n  HALT';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onReferences({
            textDocument: { uri: URI },
            position: { line: 0, character: 1 },
            context: { includeDeclaration: false },
        });

        expect(result).toHaveLength(0);
    });

    test('returns empty for unknown document', async () => {
        const server = createServer('');
        const result = await (server as any).onReferences({
            textDocument: { uri: 'file:///unknown.flux' },
            position: { line: 0, character: 0 },
            context: { includeDeclaration: true },
        });
        expect(result).toEqual([]);
    });

    test('returns empty when cursor not on a label', async () => {
        const source = 'ADD R0, R1, R2\n  HALT';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onReferences({
            textDocument: { uri: URI },
            position: { line: 0, character: 1 }, // On ADD
            context: { includeDeclaration: true },
        });

        // ADD is not a defined label, so no references
        expect(result).toHaveLength(0);
    });
});

// ─── Folding Ranges ─────────────────────────────────────────────────────────

describe('FluxLanguageServer - onFoldingRanges', () => {
    test('creates folding range for sections', async () => {
        const source = '## fn: test\n@start:\n  MOVI R0, 1\n  HALT\n## agent: other\n  HALT\n  NOP';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const ranges = await (server as any).onFoldingRanges({
            textDocument: { uri: URI },
        });

        // Only sections with > 1 line span produce folding ranges
        // First section: lines 0-4 (>1 line span) => folding
        // Second section: lines 5-7 (>1 line span) => folding
        expect(ranges.length).toBeGreaterThanOrEqual(1);
        expect(ranges[0].startLine).toBe(0);
        expect(ranges[0].kind).toBe('region');
    });

    test('no folding for single-line sections', async () => {
        const source = '## fn: test\n  HALT';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const ranges = await (server as any).onFoldingRanges({
            textDocument: { uri: URI },
        });

        // Section from line 0 to EOF = 1, which is only 1 line apart so no folding
        // findSectionEnd returns lines.length - 1 = 1, startLine + 1 = 1, not > 1
        expect(ranges).toHaveLength(0);
    });

    test('multiple sections create multiple folding ranges', async () => {
        const source = [
            '## fn: func1',
            '  HALT',
            '  HALT',
            '## fn: func2',
            '  HALT',
            '  HALT',
            '## fn: func3',
            '  HALT',
            '  HALT',
        ].join('\n');

        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const ranges = await (server as any).onFoldingRanges({
            textDocument: { uri: URI },
        });

        expect(ranges.length).toBe(3);
    });
});
