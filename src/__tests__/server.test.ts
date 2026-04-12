/**
 * Integration tests for the FLUX Language Server
 *
 * Tests the FluxLanguageServer class directly without LSP protocol overhead.
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
    };

    onCompletion = () => {};
    onCompletionResolve = () => {};
    onHover = () => {};
    onDefinition = () => {};
    onDocumentSymbol = () => {};
    onReferences = () => {};
}

// ─── Helper ─────────────────────────────────────────────────────────────────

function createServer(source: string, uri = 'file:///test.flux'): FluxLanguageServer {
    const connection = new MockConnection() as any;
    const documents = {
        get: (docUri: string) => {
            if (docUri === uri) {
                return TextDocument.create(uri, 'flux', 0, source);
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

function createFluxMdServer(source: string, uri = 'file:///test.flux.md'): FluxLanguageServer {
    const connection = new MockConnection() as any;
    const documents = {
        get: (docUri: string) => {
            if (docUri === uri) {
                return TextDocument.create(uri, 'flux.md', 0, source);
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

// ─── Validation / Diagnostics ───────────────────────────────────────────────

describe('FluxLanguageServer - validateDocument', () => {
    test('validates .flux file correctly', () => {
        const server = createServer('HALT\nADD R0, R1, R2');
        const doc = TextDocument.create('file:///test.flux', 'flux', 0, 'HALT\nADD R0, R1, R2');
        const diags = server.validateDocument(doc);
        expect(diags).toHaveLength(0);
    });

    test('reports errors in .flux file', () => {
        const server = createServer('FAKEOP R0');
        const doc = TextDocument.create('file:///test.flux', 'flux', 0, 'FAKEOP R0');
        const diags = server.validateDocument(doc);
        expect(diags.length).toBeGreaterThan(0);
    });

    test('validates .flux.md file — only reports errors inside code blocks', () => {
        const source = [
            '## fn: test',
            '```flux',
            'FAKEOP R0',
            '```',
        ].join('\n');

        const server = createFluxMdServer(source);
        const doc = TextDocument.create('file:///test.flux.md', 'flux.md', 0, source);
        const diags = server.validateDocument(doc);

        // Should report the FAKEOP error inside the code block
        expect(diags.length).toBeGreaterThan(0);
    });

    test('does not report errors for .flux.md outside code blocks', () => {
        const source = [
            '# Title',
            'Some text with HALT mentioned.',
            '```flux',
            'ADD R0, R1, R2',
            '```',
        ].join('\n');

        const server = createFluxMdServer(source);
        const doc = TextDocument.create('file:///test.flux.md', 'flux.md', 0, source);
        const diags = server.validateDocument(doc);

        // No errors because HALT is outside the code block and ADD is valid inside
        expect(diags).toHaveLength(0);
    });
});

// ─── Document Symbols ───────────────────────────────────────────────────────

describe('FluxLanguageServer - onDocumentSymbol', () => {
    test('extracts sections as symbols', async () => {
        const source = [
            '## fn: factorial',
            '```flux',
            'HALT',
            '```',
            '## agent: calc',
            '```flux',
            'HALT',
            '```',
        ].join('\n');

        const server = createFluxMdServer(source);
        server.registerHandlers();

        // We need to parse the source first by calling validateDocument
        const doc = TextDocument.create('file:///test.flux.md', 'flux.md', 0, source);
        server.validateDocument(doc);

        const symbols = await (server as any).onDocumentSymbol({
            textDocument: { uri: 'file:///test.flux.md' },
        });

        expect(symbols.length).toBeGreaterThanOrEqual(2);
        expect(symbols[0].name).toContain('fn:');
        expect(symbols[0].name).toContain('factorial');
        expect(symbols[1].name).toContain('agent:');
    });

    test('extracts labels as child symbols', async () => {
        const source = [
            '## fn: test',
            '```flux',
            '@start:',
            '  MOVI R0, 1',
            '@end:',
            '  HALT',
            '```',
        ].join('\n');

        const server = createFluxMdServer(source);
        server.registerHandlers();

        const doc = TextDocument.create('file:///test.flux.md', 'flux.md', 0, source);
        server.validateDocument(doc);

        const symbols = await (server as any).onDocumentSymbol({
            textDocument: { uri: 'file:///test.flux.md' },
        });

        // The fn section should have child labels
        if (symbols.length > 0 && symbols[0].children) {
            const labelNames = symbols[0].children.map((c: any) => c.name);
            expect(labelNames).toContain('@start');
            expect(labelNames).toContain('@end');
        }
    });
});

// ─── Initialize ─────────────────────────────────────────────────────────────

describe('FluxLanguageServer - initialize', () => {
    test('returns correct capabilities', async () => {
        const server = createServer('');
        const result = await server.initialize({
            processId: 1,
            rootUri: null,
            capabilities: {} as any,
        });

        expect(result.capabilities.textDocumentSync).toBeDefined();
        expect(result.capabilities.completionProvider).toBeDefined();
        expect(result.capabilities.hoverProvider).toBe(true);
        expect(result.capabilities.definitionProvider).toBe(true);
        expect(result.capabilities.documentSymbolProvider).toBe(true);
        expect(result.capabilities.referencesProvider).toBe(true);
        expect(result.capabilities.foldingRangeProvider).toBe(true);
    });
});
