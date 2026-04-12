/**
 * FLUX Language Server — Main LSP Server
 *
 * Provides IDE features for .flux.md files:
 * - Autocomplete for opcodes, registers, directives, labels
 * - Hover documentation for opcodes
 * - Go-to-definition for labels
 * - Document symbols (outline view)
 * - Diagnostics (error detection)
 *
 * Communicates via LSP stdio protocol with any editor client.
 */

import {
    Connection,
    InitializeParams,
    InitializeResult,
    TextDocumentSyncKind,
    CompletionParams,
    CompletionItem,
    HoverParams,
    Hover,
    DefinitionParams,
    Definition,
    DocumentSymbolParams,
    DocumentSymbol,
    SymbolKind,
    TextDocuments,
    TextDocumentChangeEvent,
    Diagnostic,
    MarkupKind,
    Range,
    Position,
} from 'vscode-languageserver';
import {
    TextDocument,
} from 'vscode-languageserver-textdocument';

import { lookupOpcode, formatOpcodeMarkdown, getOpcodeCompletionItems, getRegisterCompletionItems, getDirectiveCompletionItems } from './opcode-database';
import {
    parseFluxAssembly,
    extractLabels,
    extractLabelInfos,
    extractSections,
    ParsedLine,
    isRegister,
} from './parser';
import { provideDiagnostics } from './diagnostics';

// ─── Server Class ───────────────────────────────────────────────────────────

export class FluxLanguageServer {
    private connection: Connection;
    private documents: TextDocuments<TextDocument>;
    private parsedCache = new Map<string, ParsedLine[]>();

    constructor(connection: Connection, documents: TextDocuments<TextDocument>) {
        this.connection = connection;
        this.documents = documents;
    }

    /**
     * Initialize the language server with capabilities.
     */
    async initialize(params: InitializeParams): Promise<InitializeResult> {
        const result: InitializeResult = {
            capabilities: {
                textDocumentSync: TextDocumentSyncKind.Incremental,
                completionProvider: {
                    resolveProvider: true,
                    triggerCharacters: ['.', '@', ' ', ','],
                    allCommitCharacters: [' ', ','],
                },
                hoverProvider: true,
                definitionProvider: true,
                documentSymbolProvider: true,
                referencesProvider: false, // future: find all label usages
                codeActionProvider: false, // future: quick fixes
                signatureHelpProvider: false,
                renameProvider: false,
                foldingRangeProvider: true,
                workspaceSymbolProvider: false,
            },
        };

        this.connection.log('FLUX LSP initialized');
        this.connection.log(`Client: ${params.clientInfo?.name || 'unknown'}`);
        return result;
    }

    /**
     * Register all LSP handlers on the connection.
     */
    registerHandlers(): void {
        // Document lifecycle
        this.documents.onDidChangeContent((change) => this.onDocumentChange(change));
        this.documents.onDidOpen((event) => {
            this.validateAndSend(event.document);
        });
        this.documents.onDidClose((event) => {
            this.parsedCache.delete(event.document.uri);
            this.connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
        });

        // LSP requests
        this.connection.onCompletion((params) => this.onCompletion(params));
        this.connection.onCompletionResolve((item) => this.onCompletionResolve(item));
        this.connection.onHover((params) => this.onHover(params));
        this.connection.onDefinition((params) => this.onDefinition(params));
        this.connection.onDocumentSymbol((params) => this.onDocumentSymbol(params));

        // Folding ranges
        this.connection.languages.foldingRanges.on((params) => this.onFoldingRanges(params));
    }

    /**
     * Start listening for LSP messages.
     */
    listen(): void {
        this.documents.listen(this.connection);
        this.connection.listen();
    }

    // ─── Document Change Handler ─────────────────────────────────────────────

    private onDocumentChange(change: TextDocumentChangeEvent<TextDocument>): void {
        this.validateAndSend(change.document);
    }

    private validateAndSend(doc: TextDocument): void {
        const diagnostics = this.validateDocument(doc);
        this.connection.sendDiagnostics({ uri: doc.uri, diagnostics });
    }

    /**
     * Validate a document and return diagnostics.
     */
    validateDocument(doc: TextDocument): Diagnostic[] {
        const source = doc.getText();

        // Extract and parse only flux code blocks from .flux.md
        const diagnostics: Diagnostic[] = [];

        if (doc.uri.endsWith('.flux.md')) {
            // Parse the full document as .flux.md (handles sections, code blocks, etc.)
            const lines = parseFluxAssembly(source);
            this.parsedCache.set(doc.uri, lines);

            // Only validate lines inside ```flux code blocks
            const codeBlockRanges = this.findFluxCodeBlocks(source);

            for (const diag of provideDiagnostics(source)) {
                // Filter: only report diagnostics inside flux code blocks
                if (this.isInRange(diag.range.start, codeBlockRanges)) {
                    diagnostics.push(diag);
                }
            }
        } else {
            // Plain .flux file — validate everything
            const lines = parseFluxAssembly(source);
            this.parsedCache.set(doc.uri, lines);
            diagnostics.push(...provideDiagnostics(source));
        }

        return diagnostics;
    }

    /**
     * Find line ranges of ```flux code blocks in a .flux.md document.
     */
    private findFluxCodeBlocks(source: string): Range[] {
        const ranges: Range[] = [];
        const lines = source.split('\n');
        let inBlock = false;
        let blockStart = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (/^```flux\b/.test(line.trim())) {
                inBlock = true;
                blockStart = i + 1; // content starts on next line
            } else if (/^```/.test(line.trim()) && inBlock) {
                // End of code block
                ranges.push({
                    start: { line: blockStart, character: 0 },
                    end: { line: i - 1, character: 999 },
                });
                inBlock = false;
            }
        }

        return ranges;
    }

    /**
     * Check if a position is within any of the given ranges.
     */
    private isInRange(pos: Position, ranges: Range[]): boolean {
        return ranges.some(r =>
            pos.line >= r.start.line && pos.line <= r.end.line
        );
    }

    // ─── Completion Handler ──────────────────────────────────────────────────

    async onCompletion(params: CompletionParams): Promise<CompletionItem[] | CompletionList> {
        const uri = params.textDocument.uri;
        const doc = this.documents.get(uri);
        if (!doc) return [];

        const lines = this.getParsedLines(uri);
        const labels = extractLabels(lines);
        const triggerChar = params.context?.triggerCharacter;

        const items: CompletionItem[] = [];

        // Determine what kind of completion to provide based on context
        const line = doc.getText(Range.create(
            Position.create(params.position.line, 0),
            Position.create(params.position.line, 999),
        ));

        const wordAtCursor = this.getWordAtPosition(doc, params.position);

        // Trigger on @ — label references
        if (triggerChar === '@' || (wordAtCursor && wordAtCursor.startsWith('@'))) {
            for (const [name, lineNum] of labels) {
                items.push({
                    label: `@${name}`,
                    kind: 6, // SymbolKind.Field
                    detail: `Label (line ${lineNum + 1})`,
                    insertText: `@${name}`,
                    sortText: `a@${name}`,
                });
            }
            return items;
        }

        // Trigger on . — directives
        if (triggerChar === '.' || (wordAtCursor && wordAtCursor.startsWith('.'))) {
            items.push(...getDirectiveCompletionItems());
            return items;
        }

        // If we're at the start of a line or after whitespace, provide opcode completion
        const textBeforeCursor = doc.getText(Range.create(
            Position.create(params.position.line, 0),
            params.position,
        ));

        const isOpcodePosition = textBeforeCursor.trim() === '' ||
            textBeforeCursor.trim().match(/^@\w+\s*:\s*$/) !== null;

        if (isOpcodePosition && !triggerChar) {
            items.push(...getOpcodeCompletionItems());
            items.push(...getDirectiveCompletionItems());
            items.push(...getRegisterCompletionItems());

            // Add labels
            for (const [name, lineNum] of labels) {
                items.push({
                    label: `@${name}`,
                    kind: 6,
                    detail: `Label (line ${lineNum + 1})`,
                    sortText: `a@${name}`,
                });
            }
        } else {
            // Operand position — registers and labels
            items.push(...getRegisterCompletionItems());

            // Add label references
            for (const [name, lineNum] of labels) {
                items.push({
                    label: `@${name}`,
                    kind: 6,
                    detail: `Label (line ${lineNum + 1})`,
                    sortText: `a@${name}`,
                });
            }
        }

        return items;
    }

    /**
     * Resolve a completion item (provide extra detail when selected).
     */
    async onCompletionResolve(item: CompletionItem): Promise<CompletionItem> {
        // Check if this is an opcode
        const info = lookupOpcode(item.label);
        if (info) {
            item.documentation = formatOpcodeMarkdown(info);
        }
        return item;
    }

    // ─── Hover Handler ───────────────────────────────────────────────────────

    async onHover(params: HoverParams): Promise<Hover | null> {
        const uri = params.textDocument.uri;
        const doc = this.documents.get(uri);
        if (!doc) return null;

        const word = this.getWordAtPosition(doc, params.position);
        if (!word) return null;

        // Hover on label reference (@name)
        if (word.startsWith('@')) {
            const labelName = word.slice(1);
            const lines = this.getParsedLines(uri);
            const labels = extractLabels(lines);
            const lineNum = labels.get(labelName);
            if (lineNum !== undefined) {
                return {
                    contents: {
                        kind: MarkupKind.Markdown,
                        value: `**Label**: @${labelName}\n\nDefined at line ${lineNum + 1}`,
                    },
                };
            }
        }

        // Hover on label definition
        const lines = this.getParsedLines(uri);
        for (const line of lines) {
            if (line.lineNumber === params.position.line && line.label) {
                // Check if cursor is on the label
                const labelIdx = line.lineText.indexOf(`@${line.label}`);
                if (labelIdx >= 0) {
                    const cursorCol = params.position.character;
                    if (cursorCol >= labelIdx && cursorCol <= labelIdx + line.label.length + 1) {
                        return {
                            contents: {
                                kind: MarkupKind.Markdown,
                                value: `**Label**: @${line.label}\n\nJump target defined at line ${line.lineNumber + 1}`,
                            },
                        };
                    }
                }
            }
        }

        // Hover on opcode mnemonic
        const opcodeInfo = lookupOpcode(word.toUpperCase());
        if (opcodeInfo) {
            return {
                contents: {
                    kind: MarkupKind.Markdown,
                    value: formatOpcodeMarkdown(opcodeInfo),
                },
            };
        }

        // Hover on register
        if (isRegister(word)) {
            const regInfo = this.getRegisterHover(word);
            if (regInfo) {
                return {
                    contents: {
                        kind: MarkupKind.Markdown,
                        value: regInfo,
                    },
                };
            }
        }

        // Hover on directive
        if (word.startsWith('.')) {
            return {
                contents: {
                    kind: MarkupKind.Markdown,
                    value: `**${word}**\n\nFLUX assembler directive.`,
                },
            };
        }

        return null;
    }

    /**
     * Get hover documentation for a register.
     */
    private getRegisterHover(reg: string): string | null {
        const gpMatch = reg.match(/^R(\d+)$/);
        if (gpMatch) {
            const n = parseInt(gpMatch[1]);
            if (n > 15) return null;
            const aliases: Record<number, string> = { 11: ' (SP — Stack Pointer)', 14: ' (FP — Frame Pointer)', 15: ' (LR — Link Register)' };
            const alias = aliases[n] || '';
            return `**${reg}**${alias}\n\nGeneral-purpose integer register ${n}.\n64-bit signed integer.`;
        }

        const fpMatch = reg.match(/^F(\d+)$/);
        if (fpMatch) {
            const n = parseInt(fpMatch[1]);
            if (n > 15) return null;
            return `**${reg}**\n\nFloating-point register ${n}.\nIEEE 754 double-precision (64-bit).`;
        }

        const vecMatch = reg.match(/^V(\d+)$/);
        if (vecMatch) {
            const n = parseInt(vecMatch[1]);
            if (n > 15) return null;
            return `**${reg}**\n\nSIMD vector register ${n}.\n256-bit wide (4 × f64 or 8 × i32).`;
        }

        const specials: Record<string, string> = {
            'SP': '**SP** — Stack Pointer\n\nAlias for R11. Points to the top of the call stack.',
            'FP': '**FP** — Frame Pointer\n\nAlias for R14. Points to the current stack frame.',
            'LR': '**LR** — Link Register\n\nAlias for R15. Stores the return address after CALL/JAL.',
            'PC': '**PC** — Program Counter\n\nCurrent instruction address. Read-only in most contexts.',
            'FLAGS': '**FLAGS** — Status Flags\n\nCondition flags: Z (zero), S (sign), C (carry), V (overflow).',
        };

        return specials[reg] || null;
    }

    // ─── Go-to-Definition Handler ────────────────────────────────────────────

    async onDefinition(params: DefinitionParams): Promise<Definition> {
        const uri = params.textDocument.uri;
        const doc = this.documents.get(uri);
        if (!doc) return null;

        const word = this.getWordAtPosition(doc, params.position);
        if (!word) return null;

        // Label reference -> label definition
        if (word.startsWith('@')) {
            const labelName = word.slice(1);
            const lines = this.getParsedLines(uri);
            const labels = extractLabels(lines);
            const lineNum = labels.get(labelName);
            if (lineNum !== undefined) {
                return {
                    uri,
                    range: {
                        start: { line: lineNum, character: 0 },
                        end: { line: lineNum, character: 999 },
                    },
                };
            }
        }

        // Section reference (from #!import or #!export) -> section definition
        const lines = this.getParsedLines(uri);
        const sections = extractSections(lines);
        for (const section of sections) {
            if (section.name === word) {
                return {
                    uri,
                    range: {
                        start: section.position,
                        end: { line: section.position.line, character: 999 },
                    },
                };
            }
        }

        return null;
    }

    // ─── Document Symbols Handler ────────────────────────────────────────────

    async onDocumentSymbol(params: DocumentSymbolParams): Promise<DocumentSymbol[]> {
        const uri = params.textDocument.uri;
        const lines = this.getParsedLines(uri);
        const symbols: DocumentSymbol[] = [];

        const sections = extractSections(lines);
        const labels = extractLabelInfos(lines);

        // Add sections as top-level symbols
        for (const section of sections) {
            const kind = this.sectionToSymbolKind(section.type);
            const children: DocumentSymbol[] = [];

            // Add labels within this section's range
            const sectionEnd = this.findSectionEnd(lines, section.line);
            for (const label of labels) {
                if (label.line > section.line && label.line < sectionEnd) {
                    children.push({
                        name: `@${label.name}`,
                        kind: SymbolKind.Field,
                        range: {
                            start: label.position,
                            end: { line: label.position.line, character: 999 },
                        },
                        selectionRange: {
                            start: label.position,
                            end: { line: label.position.line, character: label.name.length + 1 },
                        },
                        detail: 'Label',
                    });
                }
            }

            symbols.push({
                name: `${section.type}: ${section.name}`,
                kind,
                range: {
                    start: section.position,
                    end: { line: sectionEnd, character: 999 },
                },
                selectionRange: {
                    start: section.position,
                    end: { line: section.position.line, character: section.name.length + 10 },
                },
                detail: section.signature,
                children: children.length > 0 ? children : undefined,
            });
        }

        // Add any labels not inside a section
        const sectionRanges = sections.map(s => ({ start: s.line, end: this.findSectionEnd(lines, s.line) }));
        for (const label of labels) {
            const insideSection = sectionRanges.some(r => label.line > r.start && label.line < r.end);
            if (!insideSection) {
                symbols.push({
                    name: `@${label.name}`,
                    kind: SymbolKind.Field,
                    range: {
                        start: label.position,
                        end: { line: label.position.line, character: 999 },
                    },
                    selectionRange: {
                        start: label.position,
                        end: { line: label.position.line, character: label.name.length + 1 },
                    },
                    detail: 'Label',
                });
            }
        }

        return symbols;
    }

    /**
     * Map section type to LSP SymbolKind.
     */
    private sectionToSymbolKind(type: string): SymbolKind {
        switch (type) {
            case 'fn': return SymbolKind.Function;
            case 'agent': return SymbolKind.Class;
            case 'tile': return SymbolKind.Module;
            case 'region': return SymbolKind.Namespace;
            case 'vocabulary': return SymbolKind.Property;
            case 'test': return SymbolKind.Method;
            default: return SymbolKind.Object;
        }
    }

    /**
     * Find the end line of a section (next section or EOF).
     */
    private findSectionEnd(lines: ParsedLine[], startLine: number): number {
        for (let i = startLine + 1; i < lines.length; i++) {
            if (lines[i].type === 'section') {
                return i - 1;
            }
        }
        return lines.length - 1;
    }

    // ─── Folding Ranges Handler ──────────────────────────────────────────────

    private onFoldingRanges(params: any): any[] {
        const uri = params.textDocument.uri;
        const lines = this.getParsedLines(uri);
        const ranges: any[] = [];

        // Fold sections
        const sections = extractSections(lines);
        for (const section of sections) {
            const endLine = this.findSectionEnd(lines, section.line);
            if (endLine > section.line + 1) {
                ranges.push({
                    startLine: section.line,
                    endLine,
                    kind: 'region',
                });
            }
        }

        return ranges;
    }

    // ─── Utilities ───────────────────────────────────────────────────────────

    /**
     * Get parsed lines for a document, using cache or re-parsing.
     */
    private getParsedLines(uri: string): ParsedLine[] {
        let lines = this.parsedCache.get(uri);
        if (!lines) {
            const doc = this.documents.get(uri);
            if (doc) {
                lines = parseFluxAssembly(doc.getText());
                this.parsedCache.set(uri, lines);
            } else {
                lines = [];
            }
        }
        return lines;
    }

    /**
     * Extract the word at a given position in a document.
     */
    private getWordAtPosition(doc: TextDocument, position: Position): string | null {
        const line = doc.getText(Range.create(
            Position.create(position.line, 0),
            Position.create(position.line, 999),
        ));

        // Find the word boundary around the cursor
        const charBefore = position.character > 0 ? line[position.character - 1] : '';
        const charAt = line[position.character] || '';

        // Build a regex for the word at the cursor
        const wordPattern = /[a-zA-Z_@.][a-zA-Z0-9_.]*/g;
        let match: RegExpExecArray | null;
        while ((match = wordPattern.exec(line)) !== null) {
            const start = match.index;
            const end = match.index + match[0].length;
            if (position.character >= start && position.character <= end) {
                return match[0];
            }
        }

        // Check for @ prefix
        if (charAt === '@' || charBefore === '@') {
            return '@';
        }

        return null;
    }
}
