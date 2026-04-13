/**
 * FLUX Language Server — Main LSP Server
 *
 * Provides IDE features for .flux, .fluxasm, and .flux.md files:
 * - Autocomplete for opcodes, registers, directives, labels
 * - Hover documentation for opcodes
 * - Go-to-definition for labels
 * - Document symbols (outline view)
 * - Diagnostics (error detection)
 * - Semantic tokens (enhanced syntax highlighting)
 * - Signature help (operand hints)
 * - Workspace symbol search
 * - Rename support for labels
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
    CompletionList,
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
    Location,
    ReferenceParams,
    SemanticTokensParams,
    SemanticTokens,
    SemanticTokensLegend,
    SignatureHelpParams,
    SignatureHelp,
    WorkspaceSymbolParams,
    PrepareRenameParams,
    RenameParams,
} from 'vscode-languageserver';
import {
    TextDocument,
} from 'vscode-languageserver-textdocument';

import { lookupOpcode, formatOpcodeMarkdown, getOpcodeCompletionItems, getRegisterCompletionItems, getDirectiveCompletionItems, OPCODE_DATABASE, ALL_REGISTERS } from './opcode-database';
import {
    parseFluxAssembly,
    extractLabels,
    extractLabelInfos,
    extractLabelReferences,
    extractSections,
    ParsedLine,
    isRegister,
} from './parser';
import { provideDiagnostics } from './diagnostics';

// ─── Semantic Token Types ────────────────────────────────────────────────────

const enum SemanticTokenType {
    mnemonic = 0,    // keyword/control
    register = 1,    // variable
    label = 2,       // function/label definition
    labelRef = 3,    // reference to label
    number = 4,      // number/immediate
    comment = 5,     // comment
    directive = 6,   // macro/preprocessor
}

const FLUX_SEMANTIC_TOKENS_LEGEND: SemanticTokensLegend = {
    tokenTypes: [
        'keyword',      // mnemonic
        'variable',      // register
        'function',      // label definition
        'variable',      // label reference
        'number',        // number/immediate
        'comment',       // comment
        'keyword',       // directive
    ],
    tokenModifiers: [],
};

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
                referencesProvider: true,
                codeActionProvider: undefined,
                foldingRangeProvider: true,
                workspaceSymbolProvider: true,
                semanticTokensProvider: {
                    legend: FLUX_SEMANTIC_TOKENS_LEGEND,
                    full: true,
                    range: true,
                },
                signatureHelpProvider: {
                    triggerCharacters: [' ', ','],
                    retriggerCharacters: [','],
                },
                renameProvider: {
                    prepareProvider: true,
                },
            },
        };

        this.connection.console.info('FLUX LSP initialized');
        this.connection.console.info(`Client: ${params.clientInfo?.name || 'unknown'}`);
        return result;
    }

    /**
     * Check if a URI is a flux assembly file (.flux, .fluxasm, .s.flux, but not .flux.md).
     */
    private isFluxAsmUri(uri: string): boolean {
        return uri.endsWith('.flux') || uri.endsWith('.fluxasm') || uri.endsWith('.s.flux');
    }

    /**
     * Check if a URI is a flux markdown file (.flux.md).
     */
    private isFluxMdUri(uri: string): boolean {
        return uri.endsWith('.flux.md');
    }

    // ─── Semantic Tokens ──────────────────────────────────────────────────

    private async onSemanticTokens(params: SemanticTokensParams): Promise<SemanticTokens> {
        const uri = params.textDocument.uri;
        const lines = this.getParsedLines(uri);
        const tokens: number[] = [];
        let prevLine = 0;
        let prevChar = 0;

        for (const line of lines) {
            if (line.type === 'opcode' && line.mnemonic) {
                const col = line.mnemonicRange?.start.character ?? 0;
                tokens.push(
                    line.lineNumber - prevLine,
                    col - prevChar,
                    line.mnemonic.length,
                    SemanticTokenType.mnemonic,
                    0,
                );
                prevLine = line.lineNumber;
                prevChar = col;
            }

            if (line.label) {
                const labelIdx = line.lineText.indexOf(`@${line.label}`);
                if (labelIdx >= 0) {
                    tokens.push(
                        line.lineNumber - prevLine,
                        labelIdx - prevChar,
                        line.label.length + 1,
                        SemanticTokenType.label,
                        0,
                    );
                    prevLine = line.lineNumber;
                    prevChar = labelIdx;
                }
            }

            // Colorize registers in operands
            if (line.operands) {
                for (const op of line.operands) {
                    if (isRegister(op)) {
                        const opIdx = line.lineText.indexOf(op, line.mnemonicRange?.end.character ?? 0);
                        if (opIdx >= 0) {
                            tokens.push(
                                line.lineNumber - prevLine,
                                opIdx - prevChar,
                                op.length,
                                SemanticTokenType.register,
                                0,
                            );
                            prevLine = line.lineNumber;
                            prevChar = opIdx;
                        }
                    }
                    // Colorize label references in operands
                    const labelMatch = op.match(/^@(\w+)$/);
                    if (labelMatch) {
                        const opIdx = line.lineText.indexOf(op, line.mnemonicRange?.end.character ?? 0);
                        if (opIdx >= 0) {
                            tokens.push(
                                line.lineNumber - prevLine,
                                opIdx - prevChar,
                                op.length,
                                SemanticTokenType.labelRef,
                                0,
                            );
                            prevLine = line.lineNumber;
                            prevChar = opIdx;
                        }
                    }
                }
            }

            // Colorize immediates in operands
            if (line.operands) {
                for (const op of line.operands) {
                    if (/^[+-]?(0[xX][0-9a-fA-F]+|0[bB][01]+|\d+)$/.test(op) && !isRegister(op)) {
                        const opIdx = line.lineText.indexOf(op, line.mnemonicRange?.end.character ?? 0);
                        if (opIdx >= 0) {
                            tokens.push(
                                line.lineNumber - prevLine,
                                opIdx - prevChar,
                                op.length,
                                SemanticTokenType.number,
                                0,
                            );
                            prevLine = line.lineNumber;
                            prevChar = opIdx;
                        }
                    }
                }
            }
        }

        return { data: tokens };
    }

    // ─── Signature Help ───────────────────────────────────────────────────

    private async onSignatureHelp(params: SignatureHelpParams): Promise<SignatureHelp | null> {
        const uri = params.textDocument.uri;
        const doc = this.documents.get(uri);
        if (!doc) return null;

        const word = this.getWordAtPosition(doc, params.position);
        if (!word) return null;

        const info = lookupOpcode(word.toUpperCase());
        if (!info || info.operands.length === 0) return null;

        const paramLabels = info.operands.map(op => {
            if (op.role === '-') return '—';
            return `*${op.role}*: ${op.description}`;
        });

        return {
            signatures: [
                {
                    label: `${info.mnemonic} ${info.operands.map(op => op.role === '-' ? '—' : op.role).join(', ')}`,
                    documentation: {
                        kind: MarkupKind.Markdown,
                        value: `**${info.mnemonic}** — ${info.description}\n\nFormat: ${info.format} | Category: ${info.category}\n\nParameters:\n${paramLabels.map(p => `- ${p}`).join('\n')}`,
                    },
                    parameters: info.operands.map(op => ({
                        label: op.role === '-' ? '—' : op.role,
                    })),
                },
            ],
            activeSignature: 0,
        };
    }

    // ─── Workspace Symbols ───────────────────────────────────────────────

    private async onWorkspaceSymbols(params: WorkspaceSymbolParams): Promise<any[]> {
        const results: any[] = [];
        const query = params.query.toLowerCase();

        // Search opcodes
        for (const [mn, info] of OPCODE_DATABASE) {
            if (mn.toLowerCase().includes(query) || info.description.toLowerCase().includes(query)) {
                results.push({
                    name: mn,
                    kind: SymbolKind.Function,
                    detail: `${info.category} — ${info.description}`,
                    data: { type: 'opcode', mnemonic: mn },
                });
            }
        }

        // Search labels from all cached documents
        for (const [uri, lines] of this.parsedCache) {
            const labels = extractLabels(lines);
            for (const [name, lineNum] of labels) {
                if (name.toLowerCase().includes(query)) {
                    results.push({
                        name: `@${name}`,
                        kind: SymbolKind.Field,
                        detail: `Label in ${uri.split('/').pop()}:${lineNum + 1}`,
                        location: {
                            uri,
                            range: {
                                start: { line: lineNum, character: 0 },
                                end: { line: lineNum, character: 999 },
                            },
                        },
                    });
                }
            }

            // Search sections from all cached documents
            const sections = extractSections(lines);
            for (const section of sections) {
                if (section.name.toLowerCase().includes(query)) {
                    results.push({
                        name: `${section.type}: ${section.name}`,
                        kind: this.sectionToSymbolKind(section.type),
                        detail: `Section in ${uri.split('/').pop()}`,
                        location: {
                            uri,
                            range: {
                                start: section.position,
                                end: { line: section.position.line, character: 999 },
                            },
                        },
                    });
                }
            }
        }

        return results.slice(0, 50); // Limit results
    }

    // ─── Rename Support ───────────────────────────────────────────────────

    private async onPrepareRename(params: PrepareRenameParams): Promise<Range | null> {
        const uri = params.textDocument.uri;
        const doc = this.documents.get(uri);
        if (!doc) return null;

        const word = this.getWordAtPosition(doc, params.position);
        if (!word) return null;

        // Only labels can be renamed
        if (word.startsWith('@')) {
            const line = doc.getText(Range.create(
                Position.create(params.position.line, 0),
                Position.create(params.position.line, 999),
            ));
            const match = word.match(/^@(\w+)/);
            if (match) {
                const startChar = line.indexOf(word);
                return {
                    start: { line: params.position.line, character: startChar + 1 },
                    end: { line: params.position.line, character: startChar + 1 + match[1].length },
                };
            }
        }

        return null;
    }

    private async onRename(params: RenameParams): Promise<any> {
        const uri = params.textDocument.uri;
        const doc = this.documents.get(uri);
        if (!doc) return null;

        const word = this.getWordAtPosition(doc, params.position);
        if (!word || !word.startsWith('@')) return null;

        const labelName = word.slice(1);
        const lines = this.getParsedLines(uri);
        const labels = extractLabels(lines);

        if (!labels.has(labelName)) return null;

        const changes: Record<string, any[]> = {};
        const uriChanges: any[] = [];

        // Rename the definition
        const defLine = labels.get(labelName)!;
        const defText = lines[defLine].lineText;
        const defIdx = defText.indexOf(`@${labelName}`);
        if (defIdx >= 0) {
            uriChanges.push({
                range: {
                    start: { line: defLine, character: defIdx + 1 },
                    end: { line: defLine, character: defIdx + 1 + labelName.length },
                },
                newText: params.newName,
            });
        }

        // Rename all references
        const labelRefs = extractLabelReferences(lines);
        for (const ref of labelRefs) {
            if (ref.name === labelName) {
                uriChanges.push({
                    range: {
                        start: { line: ref.line, character: ref.col + 1 },
                        end: { line: ref.line, character: ref.col + 1 + labelName.length },
                    },
                    newText: params.newName,
                });
            }
        }

        changes[uri] = uriChanges;
        return { changes };
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
        this.connection.languages.foldingRange.on((params) => this.onFoldingRanges(params));

        // Find references
        this.connection.onReferences((params) => this.onReferences(params));

        // Semantic tokens
        this.connection.languages.semanticTokens.on((params) => this.onSemanticTokens(params));

        // Signature help
        this.connection.onSignatureHelp((params) => this.onSignatureHelp(params));

        // Workspace symbols
        this.connection.onWorkspaceSymbol((params) => this.onWorkspaceSymbols(params));

        // Rename support (using type assertion for API compatibility)
        (this.connection.languages as any).prepareRename?.on?.((params: any) => this.onPrepareRename(params));
        (this.connection as any).onRename?.((params: any) => this.onRename(params));
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

    async onCompletion(params: CompletionParams): Promise<CompletionItem[]> {
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
            const directiveInfo = lookupDirective(word);
            if (directiveInfo) {
                return {
                    contents: {
                        kind: MarkupKind.Markdown,
                        value: formatDirectiveMarkdown(directiveInfo),
                    },
                };
            }
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

    async onDefinition(params: DefinitionParams): Promise<Definition | null> {
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

    // ─── References Handler ──────────────────────────────────────────────────

    async onReferences(params: ReferenceParams): Promise<Location[]> {
        const uri = params.textDocument.uri;
        const doc = this.documents.get(uri);
        if (!doc) return [];

        const word = this.getWordAtPosition(doc, params.position);
        if (!word || !word.startsWith('@')) return [];

        const labelName = word.startsWith('@') ? word.slice(1) : word;
        const lines = this.getParsedLines(uri);
        const locations: Location[] = [];

        for (const line of lines) {
            // Label definition
            if (line.label === labelName) {
                const col = line.lineText.indexOf(`@${labelName}`);
                locations.push({
                    uri,
                    range: {
                        start: { line: line.lineNumber, character: col >= 0 ? col : 0 },
                        end: { line: line.lineNumber, character: (col >= 0 ? col : 0) + labelName.length + 1 },
                    },
                });
            }

            // Label references in operands
            if (line.operands) {
                for (const op of line.operands) {
                    const refMatch = op.match(/^@(\w+)$/);
                    if (refMatch && refMatch[1] === labelName) {
                        const col = line.lineText.indexOf(op);
                        locations.push({
                            uri,
                            range: {
                                start: { line: line.lineNumber, character: col >= 0 ? col : 0 },
                                end: { line: line.lineNumber, character: (col >= 0 ? col : 0) + op.length },
                            },
                        });
                    }
                }
            }
        }

        return locations;
    }

    // ─── Rename Handler ──────────────────────────────────────────────────────

    onPrepareRename(params: { textDocument: { uri: string }; position: Position }): Range | null {
        const uri = params.textDocument.uri;
        const doc = this.documents.get(uri);
        if (!doc) return null;

        const word = this.getWordAtPosition(doc, params.position);
        if (!word || !word.startsWith('@')) return null;

        const line = doc.getText(Range.create(
            Position.create(params.position.line, 0),
            Position.create(params.position.line, 999),
        ));
        const idx = line.indexOf(word);
        if (idx < 0) return null;

        return Range.create(
            Position.create(params.position.line, idx),
            Position.create(params.position.line, idx + word.length),
        );
    }

    async onRenameRequest(params: RenameParams): Promise<WorkspaceEdit | null> {
        const uri = params.textDocument.uri;
        const doc = this.documents.get(uri);
        if (!doc) return null;

        const word = this.getWordAtPosition(doc, params.position);
        if (!word || !word.startsWith('@')) return null;

        const labelName = word.startsWith('@') ? word.slice(1) : word;
        const newName = params.newName.startsWith('@') ? params.newName.slice(1) : params.newName;

        // Validate new name
        if (!/^[a-zA-Z_]\w*$/.test(newName)) return null;

        const lines = this.getParsedLines(uri);
        const edits: TextEdit[] = [];

        for (const line of lines) {
            // Label definition: @oldname:
            if (line.label === labelName) {
                const oldText = `@${labelName}`;
                const col = line.lineText.indexOf(oldText);
                if (col >= 0) {
                    edits.push(TextEdit.replace(
                        Range.create(
                            Position.create(line.lineNumber, col),
                            Position.create(line.lineNumber, col + oldText.length),
                        ),
                        `@${newName}`,
                    ));
                }
            }

            // Label references in operands
            if (line.operands) {
                for (const op of line.operands) {
                    const refMatch = op.match(/^@(\w+)$/);
                    if (refMatch && refMatch[1] === labelName) {
                        const col = line.lineText.indexOf(op);
                        if (col >= 0) {
                            edits.push(TextEdit.replace(
                                Range.create(
                                    Position.create(line.lineNumber, col),
                                    Position.create(line.lineNumber, col + op.length),
                                ),
                                `@${newName}`,
                            ));
                        }
                    }
                }
            }
        }

        if (edits.length === 0) return null;

        return { changes: { [uri]: edits } };
    }

    // ─── Folding Ranges Handler ──────────────────────────────────────────────

    private onFoldingRanges(params: { textDocument: { uri: string } }): any[] {
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

    // ─── Find References Handler ─────────────────────────────────────────────

    async onReferences(params: ReferenceParams): Promise<Location[]> {
        const uri = params.textDocument.uri;
        const doc = this.documents.get(uri);
        if (!doc) return [];

        const word = this.getWordAtPosition(doc, params.position);
        if (!word) return [];

        const locations: Location[] = [];

        // Find references to a label
        const labelName = word.startsWith('@') ? word.slice(1) : word;
        const lines = this.getParsedLines(uri);
        const labels = extractLabels(lines);
        const labelRefs = extractLabelReferences(lines);

        // Only provide references if the label is defined (or if cursor is on a definition)
        if (labels.has(labelName)) {
            // Add the definition itself if includeDeclaration is true
            if (params.context.includeDeclaration) {
                const defLine = labels.get(labelName)!;
                locations.push({
                    uri,
                    range: {
                        start: { line: defLine, character: 0 },
                        end: { line: defLine, character: 999 },
                    },
                });
            }

            // Add all references
            for (const ref of labelRefs) {
                if (ref.name === labelName) {
                    locations.push({
                        uri,
                        range: {
                            start: { line: ref.line, character: ref.col },
                            end: { line: ref.line, character: ref.col + ref.name.length + 1 },
                        },
                    });
                }
            }
        }

        return locations;
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
