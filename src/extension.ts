import * as vscode from "vscode";
import * as ed from "./editorDecorator";
import { debounce } from "lodash";

const editorDecorator = new ed.EditorDecorator();

export function activate(context: vscode.ExtensionContext) {
    const schedule = debounce(editorDecorator.decorateEditor.bind(editorDecorator));

    vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor !== undefined) {
            schedule(editor);
        }
    });

    vscode.workspace.onDidChangeTextDocument((event) => {
        if (vscode.window.activeTextEditor && event.document === vscode.window.activeTextEditor.document) {
            schedule(vscode.window.activeTextEditor);
        }
    });

    if (vscode.window.activeTextEditor) {
        schedule(vscode.window.activeTextEditor);
    }
}

export function deactivate() {
    for (const editor of vscode.window.visibleTextEditors) {
        editorDecorator.disposeLastDecorations(editor);
    }
}
