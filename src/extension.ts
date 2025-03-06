import * as vscode from "vscode";
import { EditorDecorator } from "./editorDecorator";
import { ConfigManager } from "./configmanager";

var decorators: Map<vscode.TextEditor, EditorDecorator>;
var logger: vscode.OutputChannel;
var activeEditor: vscode.TextEditor;
var configManager: ConfigManager;

function onDidChangeActiveTextEditor(editor: vscode.TextEditor | undefined): any {
    if (!editor || editor === activeEditor) return;

    var d = decorators.get(activeEditor);
    if (d) {
        d.blur();
    }

    // first register change, then return; to ignore onDidChangeTextDocument that will be fired on Output panel
    activeEditor = editor;
    if (
        activeEditor.document.uri.scheme !== "file" ||
        activeEditor.document.uri.path.split("/").pop() === "settings.json"
    )
        return;

    d = decorators.get(editor);
    if (!d) {
        d = new EditorDecorator(editor, configManager, logger);
        decorators.set(editor, d);
    }
    d.focus();
}

function onDidChangeTextDocument(event: vscode.TextDocumentChangeEvent): any {
    if (event.document.uri.path !== activeEditor.document.uri.path || event.document.uri.scheme !== "file") return;

    var d = decorators.get(activeEditor);
    if (d) {
        d.contentChange();
    }
}

function onDidChangeConfiguration(e: vscode.ConfigurationChangeEvent) {
    if (!e.affectsConfiguration("dim")) return;
    configManager.clearConfigCache(e);
    vscode.window.visibleTextEditors.forEach((editor) => {
        var ad = decorators.get(editor);
        if (ad) {
            ad.onDidChangeConfiguration();
        }
    });
}

function onCommandReceiveDisableDimForCurrentEditor() {
    if (!activeEditor) return;
    var ad = decorators.get(activeEditor);
    if (ad) {
        ad.disable();
    }
}

function onCommandReceiveEnableDimForCurrentEditor() {
    if (!activeEditor) return;
    var ad = decorators.get(activeEditor);
    if (ad) {
        ad.enable();
    }
}

function onCommandReceiveToggleDimForCurrentEditor() {
    if (!activeEditor) return;
    var ad = decorators.get(activeEditor);
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
