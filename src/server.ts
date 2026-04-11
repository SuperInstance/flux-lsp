/**
 * server.ts — FLUX Language Server entry point
 *
 * WHY: This is the main entry point that wires up the LSP protocol with all our
 * providers. It receives messages from the editor (didOpen, didChange, completion
 * requests, hover requests), routes them to the appropriate provider, and sends
 * responses back over stdio. This file is the "glue" between the editor and our
 * analysis engine.
 *
 * DECISION: Use the official vscode-languageserver library rather than raw stdio.
 * Rationale: The LSP protocol has ~50 message types, complex initialization
 * handshake, and incremental document synchronization. The library handles all
 * this boilerplate so we can focus on our actual language features. It's the
 * standard approach used by virtually every language server.
 *
 * ARCHITECTURE: The server follows a layered architecture:
 *   1. Protocol Layer (this file) — handles LSP messages
 *   2. Document Layer (document-manager.ts) — caches parsed ASTs
 *   3. Analysis Layer (parser.ts, lexer.ts) — produces ASTs from text
 *   4. Provider Layer (completion.ts, hover.ts, definition.ts) — LSP features
 *   5. Data Layer (opcodes.ts, types.ts) — language definitions
 *
 * TIMESTAMP: 2026-04-12T02:45:00Z — Session 8, initial LSP server
 *
 * PROVENANCE: Built by Super Z (Architect rank) for the SuperInstance fleet.
 * The 1163-line grammar-spec.md (written in sessions 3-5) is the authoritative
 * source for .flux.md syntax. This LSP server is the executable realization of
 * that spec — turning static documentation into living IDE features.
 */

import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  TextDocumentSyncKind,
  InitializeParams,
  InitializeResult,
  CompletionItem,
  CompletionItemKind,
  Hover,
} from 'vscode-languageserver/node';

import {
  TextDocument,
} from 'vscode-languageserver-textdocument';

import { DocumentManager } from './document-manager';
import { FluxCompletionProvider } from './completion';
import { FluxHoverProvider } from './hover';
import { FluxDefinitionProvider } from './definition';
import { FluxDiagnostic, FluxDiagnosticSeverity } from './types';
import { TextDocumentPositionParams } from 'vscode-languageserver/node';

// ─── Create Connection ───

// The process communication is handled via stdio
const connection = createConnection();

// Create a manager for open text documents
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// Create our document manager and providers
const docManager = new DocumentManager();
const completionProvider = new FluxCompletionProvider(docManager);
const hoverProvider = new FluxHoverProvider(docManager);
const definitionProvider = new FluxDefinitionProvider(docManager);

// ─── Server Initialization ───

connection.onInitialize((params: InitializeParams) => {
  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: [' ', ',', '(', ':', '#', '@', '.'],
      },
      hoverProvider: true,
      definitionProvider: true,
    },
  };

  connection.console.log('FLUX Language Server initialized');
  return result;
});

// ─── Document Lifecycle ───

documents.onDidOpen(event => {
  connection.console.log(`Document opened: ${event.document.uri}`);
  const entry = docManager.openDocument(event.document);

  // Send diagnostics for the opened document
  sendDiagnostics(event.document.uri, entry.diagnostics);
});

documents.onDidChangeContent(event => {
  connection.console.log(`Document changed: ${event.document.uri}`);
  const entry = docManager.openDocument(event.document);

  // Re-analyze and send diagnostics
  sendDiagnostics(event.document.uri, entry.diagnostics);
});

documents.onDidClose(event => {
  connection.console.log(`Document closed: ${event.document.uri}`);
  docManager.closeDocument(event.document.uri);

  // Clear diagnostics
  connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

// ─── Completion Handler ───

connection.onCompletion(
  (textDocumentPosition: TextDocumentPositionParams) => {
    const uri = textDocumentPosition.textDocument.uri;
    const position = textDocumentPosition.position;

    connection.console.log(`Completion requested at ${uri}:${position.line}:${position.character}`);
    const items = completionProvider.getCompletions(uri, position);

    connection.console.log(`Returning ${items.length} completions`);
    return items;
  }
);

// ─── Hover Handler ───

connection.onHover(
  (textDocumentPosition: TextDocumentPositionParams) => {
    const uri = textDocumentPosition.textDocument.uri;
    const position = textDocumentPosition.position;

    connection.console.log(`Hover requested at ${uri}:${position.line}:${position.character}`);
    const hover = hoverProvider.getHover(uri, position);

    if (hover) {
      connection.console.log(`Returning hover for: ${hover.contents.toString().substring(0, 50)}...`);
    }

    return hover;
  }
);

// ─── Go-to-Definition Handler ───

connection.onDefinition(
  (textDocumentPosition: TextDocumentPositionParams) => {
    const uri = textDocumentPosition.textDocument.uri;
    const position = textDocumentPosition.position;

    connection.console.log(`Definition requested at ${uri}:${position.line}:${position.character}`);
    return definitionProvider.getDefinition(uri, position);
  }
);

// ─── Diagnostics Helper ───

function sendDiagnostics(uri: string, fluxDiagnostics: FluxDiagnostic[]): void {
  const diagnostics: Diagnostic[] = fluxDiagnostics.map(d => ({
    severity: d.severity === FluxDiagnosticSeverity.ERROR
      ? DiagnosticSeverity.Error
      : d.severity === FluxDiagnosticSeverity.WARNING
        ? DiagnosticSeverity.Warning
        : DiagnosticSeverity.Information,
    range: d.range,
    message: d.message,
    code: d.code,
    source: d.source || 'flux-lsp',
  }));

  connection.console.log(`Sending ${diagnostics.length} diagnostics for ${uri}`);
  connection.sendDiagnostics({ uri, diagnostics });
}

// ─── Start Listening ───

// Make the document manager listen on the connection
documents.listen(connection);

// Start the connection
connection.listen();

connection.console.log('FLUX Language Server started');
