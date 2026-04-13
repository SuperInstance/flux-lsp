/**
 * Tests for signature help, workspace symbols, and rename features
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

// ─── Signature Help Tests ───────────────────────────────────────────────────

describe('FluxLanguageServer - onSignatureHelp', () => {
    test('returns signature for three-operand opcode (ADD)', async () => {
        const source = 'ADD R0, R1, R2';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onSignatureHelp({
            textDocument: { uri: URI },
            position: { line: 0, character: 1 },
        });

        expect(result).not.toBeNull();
        expect(result.signatures).toHaveLength(1);
        expect(result.signatures[0].label).toContain('ADD');
        expect(result.signatures[0].label).toContain('rd');
        expect(result.signatures[0].label).toContain('rs1');
        expect(result.signatures[0].label).toContain('rs2');
    });

    test('signature includes documentation markdown', async () => {
        const source = 'ADD R0, R1, R2';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onSignatureHelp({
            textDocument: { uri: URI },
            position: { line: 0, character: 1 },
        });

        expect(result.signatures[0].documentation).toBeDefined();
        expect(result.signatures[0].documentation.kind).toBe('markdown');
        expect(result.signatures[0].documentation.value).toContain('ADD');
        expect(result.signatures[0].documentation.value).toContain('Format');
    });

    test('returns null for zero-operand opcode', async () => {
        const source = 'HALT';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onSignatureHelp({
            textDocument: { uri: URI },
            position: { line: 0, character: 1 },
        });

        expect(result).toBeNull();
    });

    test('returns null for unknown mnemonic', async () => {
        const source = 'FAKEOP R0';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onSignatureHelp({
            textDocument: { uri: URI },
            position: { line: 0, character: 2 },
        });

        expect(result).toBeNull();
    });

    test('returns null for no word at position', async () => {
        const source = '  ;  ';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onSignatureHelp({
            textDocument: { uri: URI },
            position: { line: 0, character: 0 },
        });

        expect(result).toBeNull();
    });

    test('signature for imm8 format opcode (MOVI)', async () => {
        const source = 'MOVI R0, 42';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onSignatureHelp({
            textDocument: { uri: URI },
            position: { line: 0, character: 1 },
        });

        expect(result).not.toBeNull();
        expect(result.signatures[0].label).toContain('rd');
        expect(result.signatures[0].label).toContain('imm8');
    });

    test('signature for imm16 format opcode (MOVI16)', async () => {
        const source = 'MOVI16 R0, 1000';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onSignatureHelp({
            textDocument: { uri: URI },
            position: { line: 0, character: 1 },
        });

        expect(result).not.toBeNull();
        expect(result.signatures[0].label).toContain('rd');
        expect(result.signatures[0].label).toContain('imm16');
    });

    test('signature uses dashes for unused operands (MOV)', async () => {
        const source = 'MOV R0, R1';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onSignatureHelp({
            textDocument: { uri: URI },
            position: { line: 0, character: 1 },
        });

        expect(result).not.toBeNull();
        expect(result.signatures[0].label).toContain('—');
    });
});

// ─── Workspace Symbols Tests ────────────────────────────────────────────────

describe('FluxLanguageServer - onWorkspaceSymbols', () => {
    test('finds opcodes matching query', async () => {
        const source = 'HALT';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onWorkspaceSymbols({
            query: 'ADD',
        });

        expect(result.length).toBeGreaterThan(0);
        const names = result.map((r: any) => r.name);
        expect(names).toContain('ADD');
    });

    test('finds opcodes by description', async () => {
        const source = 'HALT';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onWorkspaceSymbols({
            query: 'execution',
        });

        expect(result.length).toBeGreaterThan(0);
        const names = result.map((r: any) => r.name);
        expect(names).toContain('HALT');
    });

    test('finds labels matching query', async () => {
        const source = '@my_counter:\n  INC R0\n@my_flag:\n  NOP';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onWorkspaceSymbols({
            query: 'my_',
        });

        expect(result.length).toBeGreaterThanOrEqual(2);
        const names = result.map((r: any) => r.name);
        expect(names).toContain('@my_counter');
        expect(names).toContain('@my_flag');
    });

    test('returns empty for non-matching query', async () => {
        const source = 'HALT';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onWorkspaceSymbols({
            query: 'zzzzz_nonexistent_thing',
        });

        expect(result).toHaveLength(0);
    });

    test('finds sections matching query', async () => {
        const source = '## fn: factorial\nHALT\n## agent: calculator\nHALT';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onWorkspaceSymbols({
            query: 'fact',
        });

        expect(result.length).toBeGreaterThan(0);
        const names = result.map((r: any) => r.name);
        expect(names.some((n: string) => n.includes('factorial'))).toBe(true);
    });

    test('results are limited to 50', async () => {
        const source = 'HALT';
        const server = createServer(source);
        server.registerHandlers();
        const doc = TextDocument.create(URI, 'flux', 0, source);
        server.validateDocument(doc);

        const result = await (server as any).onWorkspaceSymbols({
            query: '', // empty query matches everything
        });

        expect(result.length).toBeLessThanOrEqual(50);
    });
});

// ─── Duplicate Label Diagnostics Tests ──────────────────────────────────────

describe('provideDiagnostics - duplicate labels', () => {
    test('warns about duplicate label definitions', () => {
        const { provideDiagnostics } = require('../diagnostics');
        const source = '@loop:\n  NOP\n@loop:\n  NOP';

        const diags = provideDiagnostics(source);
        const dupDiags = diags.filter((d: any) => d.code === 'flux-duplicate-label');
        expect(dupDiags).toHaveLength(1);
        expect(dupDiags[0].message).toContain('Duplicate');
        expect(dupDiags[0].message).toContain('@loop');
        expect(dupDiags[0].severity).toBe(2); // Warning
    });

    test('includes line number in duplicate label message', () => {
        const { provideDiagnostics } = require('../diagnostics');
        const source = '@dup: HALT\n@dup: NOP';

        const diags = provideDiagnostics(source);
        const dupDiags = diags.filter((d: any) => d.code === 'flux-duplicate-label');
        expect(dupDiags[0].message).toContain('line 1');
    });

    test('no duplicate warning for unique labels', () => {
        const { provideDiagnostics } = require('../diagnostics');
        const source = '@a: HALT\n@b: NOP\n@c: RET';

        const diags = provideDiagnostics(source);
        const dupDiags = diags.filter((d: any) => d.code === 'flux-duplicate-label');
        expect(dupDiags).toHaveLength(0);
    });
});

// ─── Initialize Capabilities Tests ───────────────────────────────────────────

describe('FluxLanguageServer - new capabilities', () => {
    test('capabilities include semanticTokensProvider', async () => {
        const server = createServer('');
        const result = await server.initialize({
            processId: 1,
            rootUri: null,
            capabilities: {} as any,
        });

        expect(result.capabilities.semanticTokensProvider).toBeDefined();
        expect(result.capabilities.semanticTokensProvider?.full).toBe(true);
        expect(result.capabilities.semanticTokensProvider?.range).toBe(true);
    });

    test('capabilities include signatureHelpProvider', async () => {
        const server = createServer('');
        const result = await server.initialize({
            processId: 1,
            rootUri: null,
            capabilities: {} as any,
        });

        expect(result.capabilities.signatureHelpProvider).toBeDefined();
        expect(result.capabilities.signatureHelpProvider?.triggerCharacters).toContain(' ');
        expect(result.capabilities.signatureHelpProvider?.triggerCharacters).toContain(',');
    });

    test('capabilities include workspaceSymbolProvider', async () => {
        const server = createServer('');
        const result = await server.initialize({
            processId: 1,
            rootUri: null,
            capabilities: {} as any,
        });

        expect(result.capabilities.workspaceSymbolProvider).toBe(true);
    });

    test('capabilities include renameProvider', async () => {
        const server = createServer('');
        const result = await server.initialize({
            processId: 1,
            rootUri: null,
            capabilities: {} as any,
        });

        expect(result.capabilities.renameProvider).toBeDefined();
        expect((result.capabilities.renameProvider as any).prepareProvider).toBe(true);
    });
});
