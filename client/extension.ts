/**
 * client/extension.ts — VS Code extension client for FLUX LSP
 *
 * Activates the FLUX Language Server for .fluxasm files.
 * Handles client-side LSP communication, document selectors,
 * and extension lifecycle.
 *
 * Fleet: SuperInstance/Cocapn — Task T-006
 */

import * as path from "path";
import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient | undefined;

// ---------------------------------------------------------------------------
// Extension activation
// ---------------------------------------------------------------------------

export function activate(context: vscode.ExtensionContext): void {
  // Server entry point
  const serverModule = context.asAbsolutePath(
    path.join("dist", "server.js")
  );

  // Server options — run as separate process
  const serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: {
        execArgv: ["--nolazy", "--inspect=6009"],
      },
    },
  };

  // Client options — .fluxasm file selector
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", language: "fluxasm" },
      { scheme: "untitled", language: "fluxasm" },
    ],
    synchronize: {
      // Watch .fluxasm files in workspace
      fileEvents: vscode.workspace.createFileSystemWatcher("**/*.fluxasm"),
    },
    initializationOptions: {
      fleet: "SuperInstance/Cocapn",
      task: "T-006",
      isa: "FLUX v1.0/v3.0",
    },
  };

  // Create and start the language client
  client = new LanguageClient(
    "fluxLsp",
    "FLUX Language Server",
    serverOptions,
    clientOptions
  );

  client.start();

  vscode.window.showInformationMessage(
    "FLUX LSP activated — FLUX ISA v1.0/v3.0"
  );
}

// ---------------------------------------------------------------------------
// Extension deactivation
// ---------------------------------------------------------------------------

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
