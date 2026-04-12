/**
 * FLUX Language Server — Entry Point
 *
 * Starts the LSP server via stdio, handling the LSP protocol handshake.
 * This is the main entry point invoked by:
 *   - VS Code extension client
 *   - Neovim nvim-lspconfig
 *   - Any LSP-compatible editor
 */

import {
    createConnection,
    ProposedFeatures,
    TextDocuments,
} from 'vscode-languageserver/node';
import {
    TextDocument,
} from 'vscode-languageserver-textdocument';

import { FluxLanguageServer } from './server';

// Create a connection for the server, using Node's IPC as transport.
// This connection communicates via stdio (stdin/stdout) by default.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents = new TextDocuments<TextDocument>(TextDocument);

// Create and configure the FLUX language server.
const server = new FluxLanguageServer(connection, documents);

// ─── LSP Lifecycle ──────────────────────────────────────────────────────────

connection.onInitialize(async (params) => {
    return server.initialize(params);
});

connection.onInitialized(() => {
    connection.console.log('FLUX LSP fully initialized and ready');
});

// Register all request/notification handlers.
server.registerHandlers();

// Start listening on the connection.
server.listen();
