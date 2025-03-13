import * as vscode from "vscode";
import { EditorDecorator } from "./editorDecorator";
import { ConfigManager } from "./configmanager";

var decorators: Map<vscode.TextEditor, EditorDecorator>;
var logger: vscode.OutputChannel;
var activeEditor: vscode.TextEditor | undefined;
var configManager: ConfigManager;
var documentState: Map<string, boolean>; // <editor.document.uri: boolean>

function onDidChangeActiveTextEditor(editor: vscode.TextEditor | undefined): any {
    if (activeEditor) {
        var d = decorators.get(activeEditor);
        if (d) {
            d.blur();
        }
    }

    if (
        !editor ||
        editor.document.uri.scheme !== "file" ||
        editor.document.uri.path.split("/").pop() === "settings.json"
    ) {
        activeEditor = undefined;
        return;
    }

    if (activeEditor && editor === activeEditor) return;

    // first register change, then return; to ignore onDidChangeTextDocument that will be fired on Output panel
    activeEditor = editor;

    if (activeEditor) {
        d = decorators.get(activeEditor);
        if (!d) {
            const uri = activeEditor.document.uri.toString(false);
            let enabled = documentState.get(uri);
            if (enabled === undefined) {
                enabled = true;
            }
            d = new EditorDecorator(activeEditor, configManager, enabled, logger);
            decorators.set(activeEditor, d);
        }
        d.focus();
    }
}

function onDidChangeTextDocument(event: vscode.TextDocumentChangeEvent): any {
    if (!activeEditor) return;
    if (event.document.uri.path !== activeEditor.document.uri.path || event.document.uri.scheme !== "file") return;
    logger.appendLine("onDidChangeTextDocument");

    const uri = activeEditor.document.uri.toString(false);
    const d = decorators.get(activeEditor);
    if (d) {
        d.contentChange();
    }
}

function onDidChangeConfiguration(e: vscode.ConfigurationChangeEvent) {
    if (!e.affectsConfiguration("dim")) return;
    configManager.clearConfigCache(e);
    vscode.window.visibleTextEditors.forEach((editor) => {
        const ad = decorators.get(editor);
        if (ad) {
            ad.configChange();
        }
    });
}

function onCommandReceiveDisableDimForCurrentEditor() {
    if (!activeEditor) return;
    const ad = decorators.get(activeEditor);
    if (ad) {
        ad.disable();
        // needs to store toggle state separately as vscode doesn't necessarily
        // reuse the same instance of TextEditor for same document when user
        // returns after switching tabs
        documentState.set(activeEditor.document.uri.toString(false), ad.isEnabled());
    }
}

function onCommandReceiveEnableDimForCurrentEditor() {
    if (!activeEditor) return;
    const ad = decorators.get(activeEditor);
    if (ad) {
        ad.enable();
        documentState.set(activeEditor.document.uri.toString(false), ad.isEnabled()); // read comment above
    }
}

function onCommandReceiveToggleDimForCurrentEditor() {
    if (!activeEditor) return;
    const ad = decorators.get(activeEditor);
    if (ad) {
        ad.toggle();
        documentState.set(activeEditor.document.uri.toString(false), ad.isEnabled()); // read comment above
    }
}

function onDidChangeTextEditorSelection(event: vscode.TextEditorSelectionChangeEvent) {
    if (!activeEditor || activeEditor !== event.textEditor) return;
    const ad = decorators.get(activeEditor);
    if (ad) {
        ad.selectionChange();
    }
}

export function activate(context: vscode.ExtensionContext) {
    logger = vscode.window.createOutputChannel("dim");
    logger.appendLine("init");

    decorators = new Map();
    configManager = new ConfigManager();
    documentState = new Map<string, boolean>();

    context.subscriptions.push(
        vscode.commands.registerCommand("dim.disableDimForCurrentEditor", onCommandReceiveDisableDimForCurrentEditor),
        vscode.commands.registerCommand("dim.enableDimForCurrentEditor", onCommandReceiveEnableDimForCurrentEditor),
        vscode.commands.registerCommand("dim.toggleDimForCurrentEditor", onCommandReceiveToggleDimForCurrentEditor)
    );

    vscode.workspace.onDidChangeConfiguration((e: vscode.ConfigurationChangeEvent) => {
        onDidChangeConfiguration(e);
    });

    vscode.window.onDidChangeActiveTextEditor((editor) => {
        onDidChangeActiveTextEditor(editor);
    });

    vscode.workspace.onDidChangeTextDocument((event) => {
        onDidChangeTextDocument(event);
    });

    vscode.window.visibleTextEditors.forEach((editor) => {
        onDidChangeActiveTextEditor(editor);
    });

    vscode.window.onDidChangeTextEditorSelection((event) => {
        onDidChangeTextEditorSelection(event);
    });

    if (vscode.window.activeTextEditor) {
        activeEditor = vscode.window.activeTextEditor;
    }
}

export function deactivate() {
    for (const editor of vscode.window.visibleTextEditors) {
        var ad = decorators.get(editor);
        if (ad) {
            ad.disable();
        }
    }
}
