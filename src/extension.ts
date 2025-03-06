import * as vscode from "vscode";
import { EditorDecorator } from "./editorDecorator";
import { ConfigManager } from "./configmanager";

var decorators: Map<vscode.TextEditor, EditorDecorator>; // <vscode.Uri: EditorDecorator>
var logger: vscode.OutputChannel;
var activeEditor: vscode.TextEditor | undefined;
var configManager: ConfigManager;

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
            d = new EditorDecorator(activeEditor, configManager, logger);
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
            ad.onDidChangeConfiguration();
        }
    });
}

function onCommandReceiveDisableDimForCurrentEditor() {
    if (!activeEditor) return;
    const ad = decorators.get(activeEditor);
    if (ad) {
        ad.disable();
    }
}

function onCommandReceiveEnableDimForCurrentEditor() {
    if (!activeEditor) return;
    const ad = decorators.get(activeEditor);
    if (ad) {
        ad.enable();
    }
}

function onCommandReceiveToggleDimForCurrentEditor() {
    if (!activeEditor) return;
    const ad = decorators.get(activeEditor);
    if (ad) {
        ad.toggle();
    }
}

export function activate(context: vscode.ExtensionContext) {
    logger = vscode.window.createOutputChannel("dim");
    logger.appendLine("init");

    decorators = new Map();
    configManager = new ConfigManager();

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

    if (vscode.window.activeTextEditor) {
        activeEditor = vscode.window.activeTextEditor;
    }
}

export function deactivate() {
    for (const editor of vscode.window.visibleTextEditors) {
        var ad = decorators.get(editor);
        if (ad) {
            ad._disposeLastDecorations();
        }
    }
}
