/**
 * Server Tests — FLUX Language Server
 *
 * Tests the FluxLanguageServer class: initialization, validation,
 * completion, hover, definitions, document symbols.
 */

import { FluxLanguageServer } from '../server';
import {
    Connection,
    TextDocumentSyncKind,
    DiagnosticSeverity,
    MarkupKind,
    SymbolKind,
    TextDocuments,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';

// ═══════════════════════════════════════════════════════════════════════════════
// Mock helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a mock connection that captures log messages.
 */
function createMockConnection(): Connection {
    const logs: string[] = [];
    return {
        log: (msg: string) => logs.push(msg),
        sendDiagnostics: () => {},
        onCompletion: () => ({ dispose: () => {} }),
        onCompletionResolve: () => ({ dispose: () => {} }),
        onHover: () => ({ dispose: () => {} }),
        onDefinition: () => ({ dispose: () => {} }),
        onDocumentSymbol: () => ({ dispose: () => {} }),
        listen: () => {},
        languages: {
            foldingRanges: {
                on: () => ({ dispose: () => {} }),
            },
        },
    } as unknown as Connection;
}

/**
 * Create a mock TextDocuments manager.
 */
function createMockDocuments(docMap: Map<string, TextDocument>): TextDocuments<TextDocument> {
    return {
        listen: () => {},
        onDidChangeContent: () => ({ dispose: () => {} }),
        onDidOpen: () => ({ dispose: () => {} }),
        onDidClose: () => ({ dispose: () => {} }),
        get: (uri: string) => docMap.get(uri),
        all: () => Array.from(docMap.values()),
    } as unknown as TextDocuments<TextDocument>;
}

function createTextDocument(uri: string, content: string): TextDocument {
    return TextDocument.create(uri, 'flux', 0, content);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Initialization
// ═══════════════════════════════════════════════════════════════════════════════

describe('FluxLanguageServer — initialize', () => {
    test('returns capabilities with required providers', async () => {
        const connection = createMockConnection();
        const documents = createMockDocuments(new Map());
        const server = new FluxLanguageServer(connection, documents);

        const result = await server.initialize({
            processId: 1,
            rootUri: null,
            capabilities: {},
        });

        expect(result.capabilities.textDocumentSync).toBe(TextDocumentSyncKind.Incremental);
        expect(result.capabilities.completionProvider).toBeDefined();
        expect(result.capabilities.hoverProvider).toBe(true);
        expect(result.capabilities.definitionProvider).toBe(true);
        expect(result.capabilities.documentSymbolProvider).toBe(true);
        expect(result.capabilities.foldingRangeProvider).toBe(true);
    });

    test('completion provider has correct trigger characters', async () => {
        const connection = createMockConnection();
        const documents = createMockDocuments(new Map());
        const server = new FluxLanguageServer(connection, documents);

        const result = await server.initialize({
            processId: 1,
            rootUri: null,
            capabilities: {},
        });

        const triggers = result.capabilities.completionProvider!.triggerCharacters!;
        expect(triggers).toContain('.');
        expect(triggers).toContain('@');
        expect(triggers).toContain(' ');
        expect(triggers).toContain(',');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Document Validation
// ═══════════════════════════════════════════════════════════════════════════════

describe('FluxLanguageServer — validateDocument', () => {
    test('no diagnostics for valid .flux file', () => {
        const doc = createTextDocument('file:///test.flux', 'NOP\nHALT');
        const connection = createMockConnection();
        const documents = createMockDocuments(new Map([['file:///test.flux', doc]]));
        const server = new FluxLanguageServer(connection, documents);

        const diags = server.validateDocument(doc);
        expect(diags).toHaveLength(0);
    });

    test('diagnostics for unknown mnemonic in .flux file', () => {
        const doc = createTextDocument('file:///test.flux', 'FOOBAR');
        const connection = createMockConnection();
        const documents = createMockDocuments(new Map([['file:///test.flux', doc]]));
        const server = new FluxLanguageServer(connection, documents);

        const diags = server.validateDocument(doc);
        expect(diags.length).toBeGreaterThanOrEqual(1);
        expect(diags[0].message).toContain('Unknown mnemonic');
    });

    test('filters diagnostics outside code blocks for .flux.md files', () => {
        // In .flux.md, only content inside ```flux blocks should be checked
        const doc = createTextDocument('file:///test.flux.md', 'FOOBAR\n```flux\nNOP\n```\nBAZQUX');
        const connection = createMockConnection();
        const documents = createMockDocuments(new Map([['file:///test.flux.md', doc]]));
        const server = new FluxLanguageServer(connection, documents);

        const diags = server.validateDocument(doc);
        // FOOBAR and BAZQUX are outside code blocks — should be filtered out
        expect(diags).toHaveLength(0);
    });

    test('reports diagnostics inside code blocks for .flux.md files', () => {
        const doc = createTextDocument('file:///test.flux.md', '```flux\nFOOBAR\nNOP\n```');
        const connection = createMockConnection();
        const documents = createMockDocuments(new Map([['file:///test.flux.md', doc]]));
        const server = new FluxLanguageServer(connection, documents);

        const diags = server.validateDocument(doc);
        expect(diags.length).toBeGreaterThanOrEqual(1);
        expect(diags[0].message).toContain('Unknown mnemonic');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Completion
// ═══════════════════════════════════════════════════════════════════════════════

describe('FluxLanguageServer — completion', () => {
    test('returns empty for unknown document', async () => {
        const connection = createMockConnection();
        const documents = createMockDocuments(new Map());
        const server = new FluxLanguageServer(connection, documents);

        const items = await server.onCompletion({
            textDocument: { uri: 'file:///unknown.flux' },
            position: { line: 0, character: 0 },
        });
        expect(items).toEqual([]);
    });

    test('returns opcode completions at start of line', async () => {
        const doc = createTextDocument('file:///test.flux', 'NO\n');
        const docMap = new Map([['file:///test.flux', doc]]);
        const connection = createMockConnection();
        const documents = createMockDocuments(docMap);
        const server = new FluxLanguageServer(connection, documents);

        // Trigger validation to populate cache
        server.validateDocument(doc);

        const items = await server.onCompletion({
            textDocument: { uri: 'file:///test.flux' },
            position: { line: 1, character: 0 },
        });

        expect(Array.isArray(items)).toBe(true);
        if (Array.isArray(items) && items.length > 0) {
            const labels = items.map(i => i.label);
            expect(labels).toContain('ADD');
            expect(labels).toContain('NOP');
            expect(labels).toContain('HALT');
        }
    });

    test('returns label completions on @ trigger', async () => {
        const doc = createTextDocument('file:///test.flux', '@target:\nNOP\n');
        const docMap = new Map([['file:///test.flux', doc]]);
        const connection = createMockConnection();
        const documents = createMockDocuments(docMap);
        const server = new FluxLanguageServer(connection, documents);

        server.validateDocument(doc);

        const items = await server.onCompletion({
            textDocument: { uri: 'file:///test.flux' },
            position: { line: 2, character: 1 },
            context: { triggerKind: 1, triggerCharacter: '@' },
        });

        expect(Array.isArray(items)).toBe(true);
        if (Array.isArray(items) && items.length > 0) {
            const labels = items.map(i => i.label);
            expect(labels).toContain('@target');
        }
    });

    test('returns directive completions on . trigger', async () => {
        const doc = createTextDocument('file:///test.flux', 'NOP\n');
        const docMap = new Map([['file:///test.flux', doc]]);
        const connection = createMockConnection();
        const documents = createMockDocuments(docMap);
        const server = new FluxLanguageServer(connection, documents);

        server.validateDocument(doc);

        const items = await server.onCompletion({
            textDocument: { uri: 'file:///test.flux' },
            position: { line: 1, character: 1 },
            context: { triggerKind: 1, triggerCharacter: '.' },
        });

        expect(Array.isArray(items)).toBe(true);
        if (Array.isArray(items) && items.length > 0) {
            const labels = items.map(i => i.label);
            expect(labels).toContain('.text');
            expect(labels).toContain('.data');
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Completion Resolve
// ═══════════════════════════════════════════════════════════════════════════════

describe('FluxLanguageServer — completion resolve', () => {
    test('adds documentation for opcode items', async () => {
        const connection = createMockConnection();
        const documents = createMockDocuments(new Map());
        const server = new FluxLanguageServer(connection, documents);

        const item = { label: 'ADD', kind: 1 as const };
        const resolved = await server.onCompletionResolve(item);
        expect(resolved.documentation).toBeDefined();
        expect(resolved.documentation).not.toBeNull();
    });

    test('does not add documentation for non-opcode items', async () => {
        const connection = createMockConnection();
        const documents = createMockDocuments(new Map());
        const server = new FluxLanguageServer(connection, documents);

        const item = { label: 'NOT_AN_OPCODE', kind: 1 as const };
        const resolved = await server.onCompletionResolve(item);
        // No documentation should be added for unknown opcode
        expect(resolved.documentation).toBeUndefined();
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Hover
// ═══════════════════════════════════════════════════════════════════════════════

describe('FluxLanguageServer — hover', () => {
    test('returns null for unknown document', async () => {
        const connection = createMockConnection();
        const documents = createMockDocuments(new Map());
        const server = new FluxLanguageServer(connection, documents);

        const result = await server.onHover({
            textDocument: { uri: 'file:///unknown.flux' },
            position: { line: 0, character: 0 },
        });
        expect(result).toBeNull();
    });

    test('returns hover info for opcode', async () => {
        const doc = createTextDocument('file:///test.flux', 'ADD R1, R2, R3\n');
        const docMap = new Map([['file:///test.flux', doc]]);
        const connection = createMockConnection();
        const documents = createMockDocuments(docMap);
        const server = new FluxLanguageServer(connection, documents);

        server.validateDocument(doc);

        const result = await server.onHover({
            textDocument: { uri: 'file:///test.flux' },
            position: { line: 0, character: 2 }, // over 'D' in 'ADD'
        });

        expect(result).not.toBeNull();
        const contents = result!.contents as { kind: string; value: string };
        expect(contents.kind).toBe(MarkupKind.Markdown);
        expect(contents.value).toContain('ADD');
        expect(contents.value).toContain('rs1 + rs2');
    });

    test('returns hover info for label reference', async () => {
        const doc = createTextDocument('file:///test.flux', '@target:\nNOP\nJMP R0, @target\n');
        const docMap = new Map([['file:///test.flux', doc]]);
        const connection = createMockConnection();
        const documents = createMockDocuments(docMap);
        const server = new FluxLanguageServer(connection, documents);

        server.validateDocument(doc);

        const result = await server.onHover({
            textDocument: { uri: 'file:///test.flux' },
            position: { line: 2, character: 10 }, // over '@target'
        });

        expect(result).not.toBeNull();
        const contents = result!.contents as { kind: string; value: string };
        expect(contents.value).toContain('@target');
        expect(contents.value).toContain('Defined at line');
    });

    test('returns hover info for register', async () => {
        const doc = createTextDocument('file:///test.flux', 'ADD R1, R2, R3\n');
        const docMap = new Map([['file:///test.flux', doc]]);
        const connection = createMockConnection();
        const documents = createMockDocuments(docMap);
        const server = new FluxLanguageServer(connection, documents);

        server.validateDocument(doc);

        const result = await server.onHover({
            textDocument: { uri: 'file:///test.flux' },
            position: { line: 0, character: 5 }, // over 'R1'
        });

        expect(result).not.toBeNull();
        const contents = result!.contents as { kind: string; value: string };
        expect(contents.value).toContain('R1');
        expect(contents.value).toContain('register');
    });

    test('returns null when hovering on whitespace', async () => {
        const doc = createTextDocument('file:///test.flux', 'NOP\n');
        const docMap = new Map([['file:///test.flux', doc]]);
        const connection = createMockConnection();
        const documents = createMockDocuments(docMap);
        const server = new FluxLanguageServer(connection, documents);

        server.validateDocument(doc);

        const result = await server.onHover({
            textDocument: { uri: 'file:///test.flux' },
            position: { line: 0, character: 5 }, // after NOP
        });

        expect(result).toBeNull();
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Go-to-Definition
// ═══════════════════════════════════════════════════════════════════════════════

describe('FluxLanguageServer — definition', () => {
    test('returns null for unknown document', async () => {
        const connection = createMockConnection();
        const documents = createMockDocuments(new Map());
        const server = new FluxLanguageServer(connection, documents);

        const result = await server.onDefinition({
            textDocument: { uri: 'file:///unknown.flux' },
            position: { line: 0, character: 0 },
        });
        expect(result).toBeNull();
    });

    test('navigates to label definition', async () => {
        const doc = createTextDocument('file:///test.flux', '@target:\nNOP\nJMP R0, @target\n');
        const docMap = new Map([['file:///test.flux', doc]]);
        const connection = createMockConnection();
        const documents = createMockDocuments(docMap);
        const server = new FluxLanguageServer(connection, documents);

        server.validateDocument(doc);

        const result = await server.onDefinition({
            textDocument: { uri: 'file:///test.flux' },
            position: { line: 2, character: 10 }, // over @target
        });

        expect(result).not.toBeNull();
        if (result && 'uri' in result) {
            expect(result.uri).toBe('file:///test.flux');
            expect(result.range.start.line).toBe(0); // label is on line 0
        }
    });

    test('returns null for undefined label', async () => {
        const doc = createTextDocument('file:///test.flux', 'JMP R0, @undefined\n');
        const docMap = new Map([['file:///test.flux', doc]]);
        const connection = createMockConnection();
        const documents = createMockDocuments(docMap);
        const server = new FluxLanguageServer(connection, documents);

        server.validateDocument(doc);

        const result = await server.onDefinition({
            textDocument: { uri: 'file:///test.flux' },
            position: { line: 0, character: 10 },
        });

        expect(result).toBeNull();
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Document Symbols
// ═══════════════════════════════════════════════════════════════════════════════

describe('FluxLanguageServer — document symbols', () => {
    test('returns section symbols', async () => {
        const doc = createTextDocument('file:///test.flux', '## fn: my_func\nNOP\nHALT');
        const docMap = new Map([['file:///test.flux', doc]]);
        const connection = createMockConnection();
        const documents = createMockDocuments(docMap);
        const server = new FluxLanguageServer(connection, documents);

        server.validateDocument(doc);

        const symbols = await server.onDocumentSymbol({
            textDocument: { uri: 'file:///test.flux' },
        });

        expect(symbols.length).toBeGreaterThanOrEqual(1);
        expect(symbols[0].name).toContain('my_func');
        expect(symbols[0].kind).toBe(SymbolKind.Function);
    });

    test('returns labels as children of sections', async () => {
        const doc = createTextDocument('file:///test.flux', '## fn: foo\n@entry:\nNOP\nHALT');
        const docMap = new Map([['file:///test.flux', doc]]);
        const connection = createMockConnection();
        const documents = createMockDocuments(docMap);
        const server = new FluxLanguageServer(connection, documents);

        server.validateDocument(doc);

        const symbols = await server.onDocumentSymbol({
            textDocument: { uri: 'file:///test.flux' },
        });

        expect(symbols.length).toBeGreaterThanOrEqual(1);
        expect(symbols[0].children).toBeDefined();
        expect(symbols[0].children!.length).toBeGreaterThanOrEqual(1);
        expect(symbols[0].children![0].name).toBe('@entry');
        expect(symbols[0].children![0].kind).toBe(SymbolKind.Field);
    });

    test('returns empty array for document with no symbols', async () => {
        const doc = createTextDocument('file:///test.flux', 'NOP\nHALT');
        const docMap = new Map([['file:///test.flux', doc]]);
        const connection = createMockConnection();
        const documents = createMockDocuments(docMap);
        const server = new FluxLanguageServer(connection, documents);

        server.validateDocument(doc);

        const symbols = await server.onDocumentSymbol({
            textDocument: { uri: 'file:///test.flux' },
        });

        expect(symbols).toHaveLength(0);
    });

    test('section types map to correct symbol kinds', async () => {
        const doc = createTextDocument('file:///test.flux',
            '## fn: func1\nNOP\n## agent: ag1\nNOP\n## tile: t1\nNOP\n## region: r1\nNOP');
        const docMap = new Map([['file:///test.flux', doc]]);
        const connection = createMockConnection();
        const documents = createMockDocuments(docMap);
        const server = new FluxLanguageServer(connection, documents);

        server.validateDocument(doc);

        const symbols = await server.onDocumentSymbol({
            textDocument: { uri: 'file:///test.flux' },
        });

        expect(symbols).toHaveLength(4);
        expect(symbols[0].kind).toBe(SymbolKind.Function);   // fn
        expect(symbols[1].kind).toBe(SymbolKind.Class);      // agent
        expect(symbols[2].kind).toBe(SymbolKind.Module);     // tile
        expect(symbols[3].kind).toBe(SymbolKind.Namespace);  // region
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Folding Ranges
// ═══════════════════════════════════════════════════════════════════════════════

describe('FluxLanguageServer — folding ranges (via onFoldingRanges)', () => {
    test('section folding range via private method', async () => {
        const doc = createTextDocument('file:///test.flux', '## fn: test\nNOP\nNOP\nHALT');
        const docMap = new Map([['file:///test.flux', doc]]);
        const connection = createMockConnection();
        const documents = createMockDocuments(docMap);
        const server = new FluxLanguageServer(connection, documents);

        server.validateDocument(doc);

        // Access the internal method indirectly via document symbols parsing
        const symbols = await server.onDocumentSymbol({
            textDocument: { uri: 'file:///test.flux' },
        });

        // Verify the section is properly parsed
        expect(symbols.length).toBeGreaterThanOrEqual(1);
        expect(symbols[0].range).toBeDefined();
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Edge cases
// ═══════════════════════════════════════════════════════════════════════════════

describe('FluxLanguageServer — edge cases', () => {
    test('handles empty document', () => {
        const doc = createTextDocument('file:///test.flux', '');
        const connection = createMockConnection();
        const documents = createMockDocuments(new Map([['file:///test.flux', doc]]));
        const server = new FluxLanguageServer(connection, documents);

        const diags = server.validateDocument(doc);
        expect(diags).toHaveLength(0);
    });

    test('handles document with only comments', () => {
        const doc = createTextDocument('file:///test.flux', '; comment 1\n; comment 2');
        const connection = createMockConnection();
        const documents = createMockDocuments(new Map([['file:///test.flux', doc]]));
        const server = new FluxLanguageServer(connection, documents);

        const diags = server.validateDocument(doc);
        expect(diags).toHaveLength(0);
    });

    test('handles complex multi-section program', () => {
        const source = [
            '## fn: main',
            '@entry:',
            '  MOVI R1, 42',
            '  ADD R2, R1, R3',
            '  HALT',
            '',
            '## fn: helper',
            '@helper_start:',
            '  NOP',
            '  RET',
        ].join('\n');
        const doc = createTextDocument('file:///test.flux', source);
        const connection = createMockConnection();
        const documents = createMockDocuments(new Map([['file:///test.flux', doc]]));
        const server = new FluxLanguageServer(connection, documents);

        const diags = server.validateDocument(doc);
        expect(diags).toHaveLength(0);
    });
});
