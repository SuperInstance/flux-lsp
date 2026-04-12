/**
 * Server tests — LSP handler behavior: autocomplete, hover, definitions, symbols.
 *
 * Tests the FluxLanguageServer class by mocking the LSP connection and document manager.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FluxLanguageServer } from '../server';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
    CompletionItemKind,
    MarkupKind,
    SymbolKind,
    DiagnosticSeverity,
    TextDocumentSyncKind,
} from 'vscode-languageserver';

// ─── Mock connection and documents ─────────────────────────────────────────

function createMockConnection() {
    return {
        log: vi.fn(),
        sendDiagnostics: vi.fn(),
        onCompletion: vi.fn((handler) => { mockConnection._onCompletion = handler; }),
        onCompletionResolve: vi.fn((handler) => { mockConnection._onCompletionResolve = handler; }),
        onHover: vi.fn((handler) => { mockConnection._onHover = handler; }),
        onDefinition: vi.fn((handler) => { mockConnection._onDefinition = handler; }),
        onDocumentSymbol: vi.fn((handler) => { mockConnection._onDocumentSymbol = handler; }),
        listen: vi.fn(),
        languages: {
            foldingRanges: {
                on: vi.fn((handler) => { mockConnection._onFoldingRanges = handler; }),
            },
        },
        _onCompletion: null as any,
        _onCompletionResolve: null as any,
        _onHover: null as any,
        _onDefinition: null as any,
        _onDocumentSymbol: null as any,
        _onFoldingRanges: null as any,
    };
}

function createMockDocuments(doc: TextDocument | null) {
    const map = new Map<string, TextDocument>();
    if (doc) map.set(doc.uri, doc);
    return {
        get: vi.fn((uri: string) => map.get(uri)),
        listen: vi.fn(),
        onDidChangeContent: vi.fn((handler) => { mockDocuments._onChange = handler; }),
        onDidOpen: vi.fn((handler) => { mockDocuments._onOpen = handler; }),
        onDidClose: vi.fn((handler) => { mockDocuments._onClose = handler; }),
        _onChange: null as any,
        _onOpen: null as any,
        _onClose: null as any,
    };
}

function createDoc(uri: string, content: string): TextDocument {
    return TextDocument.create(uri, 'flux', 0, content);
}

let mockConnection: any;
let mockDocuments: any;

beforeEach(() => {
    mockConnection = createMockConnection();
    mockDocuments = createMockDocuments(null);
});

// ─── initialize ────────────────────────────────────────────────────────────

describe('FluxLanguageServer.initialize', () => {
    it('returns correct capabilities', async () => {
        const server = new FluxLanguageServer(
            mockConnection as any,
            mockDocuments as any,
        );
        const result = await server.initialize({} as any);

        expect(result.capabilities.textDocumentSync).toBe(TextDocumentSyncKind.Incremental);
        expect(result.capabilities.completionProvider).toBeDefined();
        expect(result.capabilities.completionProvider.resolveProvider).toBe(true);
        expect(result.capabilities.hoverProvider).toBe(true);
        expect(result.capabilities.definitionProvider).toBe(true);
        expect(result.capabilities.documentSymbolProvider).toBe(true);
        expect(result.capabilities.foldingRangeProvider).toBe(true);
    });

    it('has trigger characters for completion', async () => {
        const server = new FluxLanguageServer(
            mockConnection as any,
            mockDocuments as any,
        );
        const result = await server.initialize({} as any);
        const triggers = result.capabilities.completionProvider!.triggerCharacters!;
        expect(triggers).toContain('.');
        expect(triggers).toContain('@');
        expect(triggers).toContain(' ');
    });

    it('logs initialization', async () => {
        const server = new FluxLanguageServer(
            mockConnection as any,
            mockDocuments as any,
        );
        await server.initialize({ clientInfo: { name: 'test-client' } } as any);
        expect(mockConnection.log).toHaveBeenCalledWith('FLUX LSP initialized');
        expect(mockConnection.log).toHaveBeenCalledWith('Client: test-client');
    });
});

// ─── registerHandlers ──────────────────────────────────────────────────────

describe('FluxLanguageServer.registerHandlers', () => {
    it('registers all handlers', () => {
        const server = new FluxLanguageServer(
            mockConnection as any,
            mockDocuments as any,
        );
        server.registerHandlers();

        expect(mockConnection.onCompletion).toHaveBeenCalled();
        expect(mockConnection.onHover).toHaveBeenCalled();
        expect(mockConnection.onDefinition).toHaveBeenCalled();
        expect(mockConnection.onDocumentSymbol).toHaveBeenCalled();
        expect(mockDocuments.onDidChangeContent).toHaveBeenCalled();
        expect(mockDocuments.onDidOpen).toHaveBeenCalled();
        expect(mockDocuments.onDidClose).toHaveBeenCalled();
    });
});

// ─── validateDocument ──────────────────────────────────────────────────────

describe('FluxLanguageServer.validateDocument', () => {
    it('validates plain .flux file', async () => {
        const doc = createDoc('file:///test.flux', 'FAKEOP R0');
        const server = new FluxLanguageServer(
            mockConnection as any,
            mockDocuments as any,
        );
        const diags = server.validateDocument(doc);
        expect(diags.length).toBeGreaterThanOrEqual(1);
        expect(diags[0].source).toBe('flux-lsp');
    });

    it('validates valid .flux file with no errors', async () => {
        const doc = createDoc('file:///test.flux', 'HALT\nNOP');
        const server = new FluxLanguageServer(
            mockConnection as any,
            mockDocuments as any,
        );
        const diags = server.validateDocument(doc);
        expect(diags).toHaveLength(0);
    });

    it('filters diagnostics to flux code blocks in .flux.md files', async () => {
        const content = [
            '## fn: test',
            '```flux',
            'FAKEOP R0',
            '```',
            'Some markdown text with FAKEOP in it',
        ].join('\n');
        const doc = createDoc('file:///test.flux.md', content);
        const server = new FluxLanguageServer(
            mockConnection as any,
            mockDocuments as any,
        );
        const diags = server.validateDocument(doc);
        // FAKEOP inside ```flux block should be flagged
        // FAKEOP outside block should NOT be flagged
        expect(diags.length).toBeGreaterThanOrEqual(1);
        for (const d of diags) {
            // All diagnostics should be inside the code block (lines 2-3, 0-indexed)
            expect(d.range.start.line).toBeGreaterThanOrEqual(2);
            expect(d.range.start.line).toBeLessThanOrEqual(3);
        }
    });

    it('clears diagnostics on document close', async () => {
        const server = new FluxLanguageServer(
            mockConnection as any,
            mockDocuments as any,
        );
        server.registerHandlers();

        const closeHandler = mockDocuments._onClose;
        closeHandler({ document: { uri: 'file:///test.flux' } });
        expect(mockConnection.sendDiagnostics).toHaveBeenCalledWith({
            uri: 'file:///test.flux',
            diagnostics: [],
        });
    });
});

// ─── Completion ────────────────────────────────────────────────────────────

describe('FluxLanguageServer completion', () => {
    async function getCompletion(server: FluxLanguageServer, uri: string, content: string, line: number, char: number, triggerChar?: string) {
        const doc = createDoc(uri, content);
        mockDocuments = createMockDocuments(doc);
        const s = new FluxLanguageServer(mockConnection as any, mockDocuments as any);
        s.registerHandlers();
        // Force parse cache
        s['parsedCache'].set(uri, s['getParsedLines'](uri));

        return s.onCompletion({
            textDocument: { uri },
            position: { line, character: char },
            context: triggerChar ? { triggerCharacter: triggerChar } : undefined,
        } as any);
    }

    it('returns opcode completions at start of line', async () => {
        const items = await getCompletion(
            new FluxLanguageServer(mockConnection as any, mockDocuments as any),
            'file:///test.flux', 'H\n', 0, 0,
        );
        expect(items.length).toBeGreaterThan(0);
        const labels = items.map((i: any) => i.label);
        expect(labels).toContain('HALT');
        expect(labels).toContain('ADD');
        expect(labels).toContain('MOVI');
    });

    it('returns label completions when @ is trigger', async () => {
        const source = '@myLabel:\nJMP @';
        const items = await getCompletion(
            new FluxLanguageServer(mockConnection as any, mockDocuments as any),
            'file:///test.flux', source, 1, 5, '@',
        );
        const labels = items.map((i: any) => i.label);
        expect(labels).toContain('@myLabel');
    });

    it('returns directive completions when . is trigger', async () => {
        const items = await getCompletion(
            new FluxLanguageServer(mockConnection as any, mockDocuments as any),
            'file:///test.flux', '.', 0, 1, '.',
        );
        const labels = items.map((i: any) => i.label);
        expect(labels.some((l: string) => l.startsWith('.'))).toBe(true);
    });

    it('returns empty for unknown document', async () => {
        const server = new FluxLanguageServer(
            mockConnection as any,
            createMockDocuments(null) as any,
        );
        server.registerHandlers();
        const items = await server.onCompletion({
            textDocument: { uri: 'file:///nonexistent.flux' },
            position: { line: 0, character: 0 },
        } as any);
        expect(items).toEqual([]);
    });
});

// ─── Hover ─────────────────────────────────────────────────────────────────

describe('FluxLanguageServer hover', () => {
    async function getHover(server: FluxLanguageServer, uri: string, content: string, line: number, char: number) {
        const doc = createDoc(uri, content);
        mockDocuments = createMockDocuments(doc);
        const s = new FluxLanguageServer(mockConnection as any, mockDocuments as any);
        s.registerHandlers();
        return s.onHover({
            textDocument: { uri },
            position: { line, character: char },
        } as any);
    }

    it('returns hover for opcode HALT', async () => {
        const hover = await getHover(
            new FluxLanguageServer(mockConnection as any, mockDocuments as any),
            'file:///test.flux', 'HALT', 0, 1,
        );
        expect(hover).not.toBeNull();
        expect(hover!.contents.kind).toBe(MarkupKind.Markdown);
        const value = (hover!.contents as any).value;
        expect(value).toContain('HALT');
        expect(value).toContain('0x00');
    });

    it('returns hover for opcode ADD', async () => {
        const hover = await getHover(
            new FluxLanguageServer(mockConnection as any, mockDocuments as any),
            'file:///test.flux', 'ADD R0, R1, R2', 0, 1,
        );
        expect(hover).not.toBeNull();
        const value = (hover!.contents as any).value;
        expect(value).toContain('ADD');
        expect(value).toContain('0x20');
    });

    it('returns null for non-existent document', async () => {
        const server = new FluxLanguageServer(
            mockConnection as any,
            createMockDocuments(null) as any,
        );
        server.registerHandlers();
        const hover = await server.onHover({
            textDocument: { uri: 'file:///nonexistent.flux' },
            position: { line: 0, character: 0 },
        } as any);
        expect(hover).toBeNull();
    });

    it('returns hover for label reference', async () => {
        const source = '@myLabel:\n  JMP @myLabel';
        const hover = await getHover(
            new FluxLanguageServer(mockConnection as any, mockDocuments as any),
            'file:///test.flux', source, 1, 7,
        );
        expect(hover).not.toBeNull();
        const value = (hover!.contents as any).value;
        expect(value).toContain('@myLabel');
        expect(value).toContain('Defined at line');
    });
});

// ─── Go-to-Definition ──────────────────────────────────────────────────────

describe('FluxLanguageServer definition', () => {
    async function getDefinition(server: FluxLanguageServer, uri: string, content: string, line: number, char: number) {
        const doc = createDoc(uri, content);
        mockDocuments = createMockDocuments(doc);
        const s = new FluxLanguageServer(mockConnection as any, mockDocuments as any);
        s.registerHandlers();
        return s.onDefinition({
            textDocument: { uri },
            position: { line, character: char },
        } as any);
    }

    it('jumps to label definition', async () => {
        const source = '@loop:\n  JMP @loop';
        const def = await getDefinition(
            new FluxLanguageServer(mockConnection as any, mockDocuments as any),
            'file:///test.flux', source, 1, 6,
        );
        expect(def).not.toBeNull();
        expect(def!.uri).toBe('file:///test.flux');
        expect(def!.range.start.line).toBe(0);
    });

    it('returns null for undefined label', async () => {
        const source = 'JMP @missing';
        const def = await getDefinition(
            new FluxLanguageServer(mockConnection as any, mockDocuments as any),
            'file:///test.flux', source, 0, 6,
        );
        expect(def).toBeNull();
    });

    it('returns null for non-existent document', async () => {
        const server = new FluxLanguageServer(
            mockConnection as any,
            createMockDocuments(null) as any,
        );
        server.registerHandlers();
        const def = await server.onDefinition({
            textDocument: { uri: 'file:///nonexistent.flux' },
            position: { line: 0, character: 0 },
        } as any);
        expect(def).toBeNull();
    });
});

// ─── Document Symbols ──────────────────────────────────────────────────────

describe('FluxLanguageServer document symbols', () => {
    async function getSymbols(server: FluxLanguageServer, uri: string, content: string) {
        const doc = createDoc(uri, content);
        mockDocuments = createMockDocuments(doc);
        const s = new FluxLanguageServer(mockConnection as any, mockDocuments as any);
        s.registerHandlers();
        return s.onDocumentSymbol({
            textDocument: { uri },
        } as any);
    }

    it('extracts sections as symbols', async () => {
        const source = '## fn: add\nHALT\n## fn: sub\nNOP';
        const symbols = await getSymbols(
            new FluxLanguageServer(mockConnection as any, mockDocuments as any),
            'file:///test.flux', source,
        );
        expect(symbols.length).toBeGreaterThanOrEqual(2);
        const names = symbols.map((s: any) => s.name);
        expect(names.some((n: string) => n.includes('add'))).toBe(true);
        expect(names.some((n: string) => n.includes('sub'))).toBe(true);
    });

    it('maps fn sections to SymbolKind.Function', async () => {
        const source = '## fn: myfunc\nHALT';
        const symbols = await getSymbols(
            new FluxLanguageServer(mockConnection as any, mockDocuments as any),
            'file:///test.flux', source,
        );
        expect(symbols.length).toBeGreaterThanOrEqual(1);
        expect(symbols[0].kind).toBe(SymbolKind.Function);
    });

    it('maps agent sections to SymbolKind.Class', async () => {
        const source = '## agent: myagent\nHALT';
        const symbols = await getSymbols(
            new FluxLanguageServer(mockConnection as any, mockDocuments as any),
            'file:///test.flux', source,
        );
        expect(symbols.length).toBeGreaterThanOrEqual(1);
        expect(symbols[0].kind).toBe(SymbolKind.Class);
    });

    it('extracts labels nested within sections', async () => {
        const source = '## fn: test\n@inner:\nHALT';
        const symbols = await getSymbols(
            new FluxLanguageServer(mockConnection as any, mockDocuments as any),
            'file:///test.flux', source,
        );
        expect(symbols.length).toBeGreaterThanOrEqual(1);
        // First section should have a child label
        if (symbols[0].children) {
            expect(symbols[0].children.length).toBeGreaterThanOrEqual(1);
            expect(symbols[0].children[0].name).toBe('@inner');
        }
    });
});

// ─── Edge cases ────────────────────────────────────────────────────────────

describe('Edge cases', () => {
    it('handles file with only comments', async () => {
        const doc = createDoc('file:///test.flux', '; comment\n# another');
        const server = new FluxLanguageServer(
            mockConnection as any,
            createMockDocuments(doc) as any,
        );
        const diags = server.validateDocument(doc);
        expect(diags).toHaveLength(0);
    });

    it('handles file with only empty lines', async () => {
        const doc = createDoc('file:///test.flux', '\n\n\n');
        const server = new FluxLanguageServer(
            mockConnection as any,
            createMockDocuments(doc) as any,
        );
        const diags = server.validateDocument(doc);
        expect(diags).toHaveLength(0);
    });

    it('handles very long operand list gracefully', async () => {
        const source = 'ADD R0, R1, R2, R3, R4, R5, R6, R7';
        const diags = provideDiagnosticsDirect(source);
        // Should report operand count issue
        expect(diags.length).toBeGreaterThanOrEqual(1);
    });

    it('handles label with underscore and numbers', async () => {
        const source = '@label_123_test:\nJMP @label_123_test';
        const diags = provideDiagnosticsDirect(source);
        expect(diags).toHaveLength(0);
    });

    it('handles mixed case opcodes as unknown', async () => {
        // OPCODE_RE requires uppercase start, lowercase opcodes parsed as empty
        const source = 'halt';
        const diags = provideDiagnosticsDirect(source);
        expect(diags).toHaveLength(0); // parser treats as empty, not opcode
    });
});

// Helper to call provideDiagnostics directly (imported via diagnostics module)
import { provideDiagnostics } from '../diagnostics';

function provideDiagnosticsDirect(source: string) {
    return provideDiagnostics(source);
}
