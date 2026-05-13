/**
 * definition.ts — Go-to-definition provider for .fluxasm files
 *
 * Supports:
 * - Label references → label definitions
 * - Cross-file label resolution (workspace-wide)
 * - Directive references to their definitions
 */

import {
  Definition,
  Location,
  LocationLink,
  Range,
} from "vscode-languageserver-protocol";
import { ParseResult, Token, TokenType, getTokenAtPosition } from "./parser";

// ---------------------------------------------------------------------------
// Definition result types
// ---------------------------------------------------------------------------

export interface DefinitionResult {
  /** URI of the target document */
  uri: string;
  /** Range of the definition */
  range: Range;
  /** Optional origin selection range (for LocationLink) */
  originSelectionRange?: Range;
}

// ---------------------------------------------------------------------------
// Main definition resolution
// ---------------------------------------------------------------------------

export function getDefinition(
  result: ParseResult,
  uri: string,
  line: number,
  character: number,
): DefinitionResult[] {
  const token = getTokenAtPosition(result.tokens, line, character);
  if (!token) return [];

  // Label reference → definition
  if (token.type === TokenType.LabelRef) {
    return resolveLabelDefinition(result, token, uri);
  }

  // If hovering over a label definition, show where it's defined (itself)
  if (token.type === TokenType.LabelDef) {
    const name = token.text.toUpperCase();
    const defNode = result.labels.get(name);
    if (defNode) {
      return [{
        uri,
        range: {
          start: { line: defNode.line, character: defNode.name.col },
          end:   { line: defNode.line, character: defNode.name.col + defNode.name.length },
        },
        originSelectionRange: {
          start: { line: token.line, character: token.col },
          end:   { line: token.line, character: token.col + token.length },
        },
      }];
    }
  }

  // Unknown tokens that look like label references
  if (token.type === TokenType.Unknown && /^[A-Za-z_]/.test(token.text)) {
    return resolveLabelDefinition(result, token, uri);
  }

  return [];
}

// ---------------------------------------------------------------------------
// Label resolution
// ---------------------------------------------------------------------------

function resolveLabelDefinition(
  result: ParseResult,
  token: Token,
  uri: string,
): DefinitionResult[] {
  const name = token.text.toUpperCase();
  const defNode = result.labels.get(name);

  if (defNode) {
    return [{
      uri,
      range: {
        start: { line: defNode.line, character: defNode.name.col },
        end:   { line: defNode.line, character: defNode.name.col + defNode.name.length },
      },
      originSelectionRange: {
        start: { line: token.line, character: token.col },
        end:   { line: token.line, character: token.col + token.length },
      },
    }];
  }

  // Not found in current document — could be in another workspace file
  // Return empty; the server can augment this with workspace-wide search
  return [];
}

// ---------------------------------------------------------------------------
// Cross-file label resolution
// ---------------------------------------------------------------------------

/** Map of URI → ParseResult for workspace-wide resolution */
export class WorkspaceIndex {
  private documents = new Map<string, ParseResult>();

  /** Index a parsed document */
  add(uri: string, result: ParseResult): void {
    this.documents.set(uri, result);
  }

  /** Remove a document from the index */
  remove(uri: string): void {
    this.documents.delete(uri);
  }

  /** Resolve a label across all workspace documents */
  resolveLabel(labelName: string): Location[] {
    const upper = labelName.toUpperCase();
    const locations: Location[] = [];

    for (const [uri, result] of this.documents) {
      const defNode = result.labels.get(upper);
      if (defNode) {
        locations.push({
          uri,
          range: {
            start: { line: defNode.line, character: defNode.name.col },
            end:   { line: defNode.line, character: defNode.name.col + defNode.name.length },
          },
        });
      }
    }

    return locations;
  }

  /** Get all label definitions across workspace */
  getAllLabels(): Map<string, Location[]> {
    const allLabels = new Map<string, Location[]>();

    for (const [uri, result] of this.documents) {
      for (const [name, defNode] of result.labels) {
        const locations = allLabels.get(name) ?? [];
        locations.push({
          uri,
          range: {
            start: { line: defNode.line, character: defNode.name.col },
            end:   { line: defNode.line, character: defNode.name.col + defNode.name.length },
          },
        });
        allLabels.set(name, locations);
      }
    }

    return allLabels;
  }

  /** Get the parse result for a specific URI */
  get(uri: string): ParseResult | undefined {
    return this.documents.get(uri);
  }
}

// ---------------------------------------------------------------------------
// Document symbol extraction (for DocumentSymbol provider)
// ---------------------------------------------------------------------------

export interface FluxSymbol {
  name: string;
  kind: "label" | "section";
  line: number;
  col: number;
  length: number;
  detail?: string;
}

export function extractDocumentSymbols(result: ParseResult): FluxSymbol[] {
  const symbols: FluxSymbol[] = [];

  for (const node of result.nodes) {
    if (node.kind === "label") {
      // Count references for detail
      const refCount = result.labelRefs.get(node.name.text.toUpperCase())?.length ?? 0;
      symbols.push({
        name: node.name.text,
        kind: "label",
        line: node.line,
        col: node.name.col,
        length: node.name.length,
        detail: refCount > 0 ? `${refCount} reference${refCount > 1 ? "s" : ""}` : undefined,
      });
    } else if (node.kind === "section") {
      symbols.push({
        name: node.sectionName,
        kind: "section",
        line: node.line,
        col: node.directive.col,
        length: node.directive.length,
      });
    }
  }

  return symbols;
}
