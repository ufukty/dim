import * as vscode from "vscode";
import * as ed from "./editorDecorator";

var decorators: Map<vscode.TextEditor, ed.EditorDecorator>;
var logger: vscode.OutputChannel;
var activeEditor: vscode.TextEditor;
var filenamesToIgnore: RegExp;

export function activate(context: vscode.ExtensionContext) {
    logger = vscode.window.createOutputChannel("dim");
    logger.appendLine("init");

    decorators = new Map();

    vscode.window.onDidChangeActiveTextEditor((editor) => {
        // logger.appendLine("onDidChangeActiveTextEditor: " + editor.document.uri.path.toString());
        if (editor === undefined || editor === activeEditor || editor.document.uri.scheme !== "file") return;
        console.log(activeEditor.document.uri.scheme);

        var d = decorators.get(activeEditor);
        if (d) {
            d.blur();
        }
        activeEditor = editor;

        var d = decorators.get(editor);
        if (d === undefined) {
            d = new ed.EditorDecorator(editor, logger);
            decorators.set(editor, d);
        }
        d.focus();
    });

    vscode.workspace.onDidChangeTextDocument((event) => {
        if (activeEditor.document.uri.scheme !== "file") return;
        console.log(activeEditor.document.uri.scheme);

        var d = decorators.get(activeEditor);
        if (d) {
            d.contentChange();
        }

        // const activeEditor = vscode.window.activeTextEditor;
        // if (activeEditor === undefined || event.document !== activeEditor.document) return;
        // logger.appendLine("onDidChangeTextDocument: " + event.document.uri.path.toString());
        // editorDecorator.schedule(activeEditor);

        // console.log(event.document, event.reason);
    });

    if (vscode.window.activeTextEditor) {
        // logger.appendLine("startup: " + vscode.window.activeTextEditor.document.uri.path.toString());
        // editorDecorator.schedule(vscode.window.activeTextEditor);
    }
}

export function deactivate() {
    for (const editor of vscode.window.visibleTextEditors) {
        // editorDecorator.disposeLastDecorations(editor);
    }
}
