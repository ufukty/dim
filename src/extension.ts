import * as vscode from "vscode";
import * as ed from "./editorDecorator";

var decorators: Map<vscode.TextEditor, ed.EditorDecorator>;
var logger: vscode.OutputChannel;
var activeEditor: vscode.TextEditor;

function onDidChangeActiveTextEditor(editor: vscode.TextEditor | undefined): any {
    if (editor === undefined || editor === activeEditor) return;

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

    var d = decorators.get(editor);
    if (d === undefined) {
        d = new ed.EditorDecorator(editor, logger);
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

export function activate(context: vscode.ExtensionContext) {
    logger = vscode.window.createOutputChannel("dim");
    logger.appendLine("init");

    decorators = new Map();

    vscode.window.onDidChangeActiveTextEditor((editor) => {
        onDidChangeActiveTextEditor(editor);
    });

    if (vscode.window.activeTextEditor) {
        onDidChangeActiveTextEditor(vscode.window.activeTextEditor);
    }

    vscode.workspace.onDidChangeTextDocument((event) => {
        onDidChangeTextDocument(event);
    });
}

export function deactivate() {
    for (const editor of vscode.window.visibleTextEditors) {
        // editorDecorator.disposeLastDecorations(editor);
    }
}
