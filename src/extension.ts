import * as vscode from "vscode";
import * as ed from "./editorDecorator";
import { debounce } from "lodash";

var editorDecorator: ed.EditorDecorator;
var logger: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    logger = vscode.window.createOutputChannel("dim");
    logger.appendLine("init");

    editorDecorator = new ed.EditorDecorator(logger);

    var schedule = debounce(editorDecorator.decorateEditor.bind(editorDecorator), 200);

    vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor === undefined) return;
        // logger.appendLine("onDidChangeActiveTextEditor: " + editor.document.uri.path.toString());
        schedule(editor);
    });

    vscode.workspace.onDidChangeTextDocument((event) => {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor === undefined || event.document !== activeEditor.document) return;
        // logger.appendLine("onDidChangeTextDocument: " + event.document.uri.path.toString());
        schedule(activeEditor);
    });

    if (vscode.window.activeTextEditor) {
        // logger.appendLine("startup: " + vscode.window.activeTextEditor.document.uri.path.toString());
        schedule(vscode.window.activeTextEditor);
    }
}

export function deactivate() {
    for (const editor of vscode.window.visibleTextEditors) {
        editorDecorator.disposeLastDecorations(editor);
    }
}
