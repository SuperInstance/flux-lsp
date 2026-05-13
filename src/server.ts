/**
 * server.ts — Main LSP server for .fluxasm files
 *
 * Implements a Language Server Protocol server for the FLUX ISA assembly language.
 * Capabilities: diagnostics, hover, completion, go-to-definition, document symbols.
 *
 * Communication: stdio (standard input/output)
 *
 * Fleet: SuperInstance/Cocapn — Task T-006
 */

import {
  createConnection,
  TextDocuments,
  Diagnostic,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
  TextDocumentPositionParams,
  CompletionParams,
  Hover,
  CompletionList,
  Definition,
  Location,
  DocumentSymbol,
  DocumentSymbolParams,
  SymbolKind,
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";

import { parse, ParseResult } from "./parser";
import { computeDiagnostics } from "./diagnostics";
import { getHover } from "./hover";
import { getCompletions, TRIGGER_CHARACTERS } from "./completion";
import { getDefinition, WorkspaceIndex, extractDocumentSymbols, DefinitionResult } from "./definition";

// ---------------------------------------------------------------------------
// Connection & document manager
// ---------------------------------------------------------------------------

const connection = createConnection(ProposedFeatures.all);

const documents = new TextDocuments(TextDocument);

// ---------------------------------------------------------------------------
// Document parse cache
// ---------------------------------------------------------------------------

const parseCache = new Map<string, ParseResult>();
const workspaceIndex = new WorkspaceIndex();

function getOrParse(uri: string): ParseResult {
  const cached = parseCache.get(uri);
  if (cached) return cached;

  const doc = documents.get(uri);
  if (!doc) {
    // Return empty parse result
    return {
      nodes: [],
      tokens: [],
      labels: new Map(),
      labelRefs: new Map(),
      sections: [],
      usedOpcodes: new Set(),
      lines: new Map(),
      lineCount: 0,
    };
  }

  const result = parse(doc.getText());
  parseCache.set(uri, result);
  workspaceIndex.add(uri, result);
  return result;
}

function invalidateCache(uri: string): void {
  parseCache.delete(uri);
}

// ---------------------------------------------------------------------------
// Server initialization
// ---------------------------------------------------------------------------

connection.onInitialize((params: InitializeParams) => {
  connection.console.log("FLUX LSP server initializing...");
  connection.console.log(`Client: ${params.clientInfo?.name ?? "unknown"} v${params.clientInfo?.version ?? "?"}`);

  return {
    capabilities: {
      textDocumentSync: {
        openClose: true,
        change: TextDocumentSyncKind.Full,
      },
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: TRIGGER_CHARACTERS,
        allCommitCharacters: [",", " ", "\t"],
      },
      hoverProvider: true,
      definitionProvider: true,
      documentSymbolProvider: true,
    },
  };
});

connection.onInitialized(() => {
  connection.console.log("FLUX LSP server ready — FLUX ISA v1.0/v3.0");
  connection.console.log("Capabilities: diagnostics, hover, completion, definition, document-symbol");
});

// ---------------------------------------------------------------------------
// Document lifecycle
// ---------------------------------------------------------------------------

documents.onDidOpen((event) => {
  connection.console.log(`Document opened: ${event.document.uri}`);
  invalidateCache(event.document.uri);
  const result = getOrParse(event.document.uri);
  const diagnostics = computeDiagnostics(result);
  connection.sendDiagnostics({ uri: event.document.uri, diagnostics });
});

documents.onDidChangeContent((event) => {
  invalidateCache(event.document.uri);
  const result = getOrParse(event.document.uri);
  const diagnostics = computeDiagnostics(result);
  connection.sendDiagnostics({ uri: event.document.uri, diagnostics });
});

documents.onDidClose((event) => {
  connection.console.log(`Document closed: ${event.document.uri}`);
  parseCache.delete(event.document.uri);
  workspaceIndex.remove(event.document.uri);
  // Clear diagnostics
  connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

// ---------------------------------------------------------------------------
// Hover
// ---------------------------------------------------------------------------

connection.onHover((params: TextDocumentPositionParams): Hover | null => {
  const result = getOrParse(params.textDocument.uri);
  return getHover(result, params.position.line, params.position.character);
});

// ---------------------------------------------------------------------------
// Completion
// ---------------------------------------------------------------------------

connection.onCompletion((params: CompletionParams): CompletionList => {
  const result = getOrParse(params.textDocument.uri);
  return getCompletions(result, params.position);
});

// ---------------------------------------------------------------------------
// Go-to-definition
// ---------------------------------------------------------------------------

connection.onDefinition((params: TextDocumentPositionParams): Definition | null => {
  const result = getOrParse(params.textDocument.uri);
  const defs = getDefinition(result, params.textDocument.uri, params.position.line, params.position.character);

  if (defs.length === 0) return null;

  if (defs.length === 1) {
    const d = defs[0];
    return {
      uri: d.uri,
      range: d.range,
    };
  }

  return defs.map(d => ({
    uri: d.uri,
    range: d.range,
  }));
});

// ---------------------------------------------------------------------------
// Document symbols
// ---------------------------------------------------------------------------

connection.onDocumentSymbol((params: DocumentSymbolParams): DocumentSymbol[] => {
  const result = getOrParse(params.textDocument.uri);
  const symbols = extractDocumentSymbols(result);

  return symbols.map(s => {
    const range = {
      start: { line: s.line, character: s.col },
      end:   { line: s.line, character: s.col + s.length },
    };

    return {
      name: s.name,
      kind: s.kind === "label" ? SymbolKind.Field : SymbolKind.Namespace,
      range,
      selectionRange: range,
      detail: s.detail,
    };
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

documents.listen(connection);
connection.listen();

connection.console.log("═══════════════════════════════════════════════════");
connection.console.log("  FLUX LSP Server — T-006 — SuperInstance/Cocapn");
connection.console.log("  FLUX ISA v1.0/v3.0 — 256-slot instruction set");
connection.console.log("  Listening on stdio...");
connection.console.log("═══════════════════════════════════════════════════");
