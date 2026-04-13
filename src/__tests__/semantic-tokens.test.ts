/**
 * Tests for semantic token generation in FluxLanguageServer
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
        foldingRange: { on: () => {} },
        semanticTokens: { on: () => {} },
        prepareRename: { on: () => {} },
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

// ─── Semantic Token Tests ──────────────────────────────────────────────────

describe('FluxLanguageServer - onSemanticTokens', () => {
    test('generates tokens for opcode mnemonic', async () => {
        const source = 'ADD R0, R1, R2';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onSemanticTokens({
            textDocument: { uri: URI },
        });

        expect(result).toBeDefined();
        expect(result.data).toBeDefined();
        expect(result.data.length).toBeGreaterThan(0);
        // First token should be the ADD mnemonic
        expect(result.data[0]).toBe(0); // deltaLine = 0
        expect(result.data[1]).toBe(0); // deltaStart = 0
        expect(result.data[2]).toBe(3); // length = 3 (ADD)
        expect(result.data[3]).toBe(0); // tokenType = mnemonic
    });

    test('generates tokens for labels', async () => {
        const source = '@loop:\n  JMP @loop';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onSemanticTokens({
            textDocument: { uri: URI },
        });

        expect(result.data.length).toBeGreaterThan(0);
        // Find the label token — should have type 2 (label)
        const hasLabelToken = result.data.some((v: number, i: number) => i % 5 === 3 && v === 2);
        expect(hasLabelToken).toBe(true);
    });

    test('generates tokens for registers in operands', async () => {
        const source = 'ADD R0, R1, R2';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onSemanticTokens({
            textDocument: { uri: URI },
        });

        // Should have register tokens (type 1)
        const registerTokens = [];
        for (let i = 3; i < result.data.length; i += 5) {
            if (result.data[i] === 1) registerTokens.push(result.data[i]);
        }
        expect(registerTokens.length).toBeGreaterThan(0);
    });

    test('generates tokens for immediate values', async () => {
        const source = 'MOVI R0, 42\nADDI R1, 0xFF';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onSemanticTokens({
            textDocument: { uri: URI },
        });

        // Should have number tokens (type 4)
        const numberTokens = [];
        for (let i = 3; i < result.data.length; i += 5) {
            if (result.data[i] === 4) numberTokens.push(result.data[i]);
        }
        expect(numberTokens.length).toBeGreaterThan(0);
    });

    test('generates tokens for label references', async () => {
        const source = '@target:\n  JMP @target';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onSemanticTokens({
            textDocument: { uri: URI },
        });

        // Should have label ref tokens (type 3)
        const labelRefTokens = [];
        for (let i = 3; i < result.data.length; i += 5) {
            if (result.data[i] === 3) labelRefTokens.push(result.data[i]);
        }
        expect(labelRefTokens.length).toBeGreaterThan(0);
    });

    test('generates tokens for hex immediates', async () => {
        const source = 'MOVI R0, 0xAB';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onSemanticTokens({
            textDocument: { uri: URI },
        });

        // Should have number tokens (type 4)
        const numberTokens = [];
        for (let i = 3; i < result.data.length; i += 5) {
            if (result.data[i] === 4) numberTokens.push(result.data[i]);
        }
        expect(numberTokens.length).toBeGreaterThan(0);
    });

    test('generates tokens for binary immediates', async () => {
        const source = 'MOVI R0, 0b1010';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onSemanticTokens({
            textDocument: { uri: URI },
        });

        const numberTokens = [];
        for (let i = 3; i < result.data.length; i += 5) {
            if (result.data[i] === 4) numberTokens.push(result.data[i]);
        }
        expect(numberTokens.length).toBeGreaterThan(0);
    });

    test('generates tokens for special registers', async () => {
        const source = 'PUSH SP\nPOP FP';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onSemanticTokens({
            textDocument: { uri: URI },
        });

        // Should have register tokens (type 1) for SP and FP
        const registerTokens = [];
        for (let i = 3; i < result.data.length; i += 5) {
            if (result.data[i] === 1) registerTokens.push(result.data[i]);
        }
        expect(registerTokens.length).toBeGreaterThan(0);
    });

    test('returns empty tokens for empty document', async () => {
        const source = '';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onSemanticTokens({
            textDocument: { uri: URI },
        });

        expect(result.data.length).toBe(0);
    });

    test('returns empty tokens for comments only', async () => {
        const source = '; this is just a comment\n; another comment';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onSemanticTokens({
            textDocument: { uri: URI },
        });

        expect(result.data.length).toBe(0);
    });

    test('handles multi-line program with mixed tokens', async () => {
        const source = [
            '@start:',
            '  MOVI R0, 42',
            '  MOVI R1, 10',
            '@loop:',
            '  ADD R0, R0, R1',
            '  DEC R1',
            '  JNZ R1, @loop',
            '  HALT',
        ].join('\n');

        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onSemanticTokens({
            textDocument: { uri: URI },
        });

        // Should have tokens for mnemonics, labels, registers, immediates, and label refs
        expect(result.data.length).toBeGreaterThan(10);
    });
});
