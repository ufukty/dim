import * as vscode from "vscode";
import { EditorDecorator } from "./editorDecorator";
import { Cache } from "./configManager";

class ExtensionLifecycleController {
  decorators: Map<vscode.TextEditor, EditorDecorator>;
  logger: vscode.OutputChannel;
  activeEditor: vscode.TextEditor | undefined;
  config: Cache;
  documentState: Map<string, boolean>; // <editor.document.uri: boolean>
  context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.logger = vscode.window.createOutputChannel("dim");
    this.logger.appendLine("init");
    this.decorators = new Map();
    this.config = new Cache(this.logger);
    this.documentState = new Map<string, boolean>();

    /* prettier-ignore */
    context.subscriptions.push(
      vscode.commands.registerCommand("dim.disableDimForCurrentEditor", this.onCommandReceiveDisableDimForCurrentEditor, this),
      vscode.commands.registerCommand("dim.enableDimForCurrentEditor", this.onCommandReceiveEnableDimForCurrentEditor, this),
      vscode.commands.registerCommand("dim.toggleDimForCurrentEditor", this.onCommandReceiveToggleDimForCurrentEditor, this),
      vscode.window.onDidChangeActiveTextEditor(this.onDidChangeActiveTextEditor, this),
      vscode.window.onDidChangeTextEditorSelection(this.onDidChangeTextEditorSelection, this),
      vscode.workspace.onDidChangeConfiguration(this.onDidChangeConfiguration, this),
      vscode.workspace.onDidChangeTextDocument(this.onDidChangeTextDocument, this),
    );

    vscode.window.visibleTextEditors.forEach(this.onDidChangeActiveTextEditor, this);

    if (vscode.window.activeTextEditor) {
      this.activeEditor = vscode.window.activeTextEditor;
    }
  }

  prompt(e: unknown) {
    vscode.window.showWarningMessage(`Dim: ${e}`);
  }

  onDidChangeActiveTextEditor(editor: vscode.TextEditor | undefined) {
    try {
      if (this.activeEditor) this.decorators.get(this.activeEditor)?.blur();

      if (
        !editor ||
        editor.document.uri.scheme !== "file" ||
        editor.document.uri.path.split("/").pop() === "settings.json"
      ) {
        this.activeEditor = undefined;
        return;
      }

      if (this.activeEditor && editor === this.activeEditor) return;

      // first register change, then return; to ignore onDidChangeTextDocument that will be fired on Output panel
      this.activeEditor = editor;

      if (this.activeEditor) {
        let d = this.decorators.get(this.activeEditor);
        if (!d) {
          const uri = this.activeEditor.document.uri.toString(false);
          let enabled = this.documentState.get(uri);
          if (enabled === undefined) {
            enabled = true;
          }
          d = new EditorDecorator(this.activeEditor, this.config, enabled, this.logger);
          this.decorators.set(this.activeEditor, d);
        }
        d.focus();
      }
    } catch (e) {
      this.prompt(e);
    }
  }

  onDidChangeTextDocument(event: vscode.TextDocumentChangeEvent) {
    try {
      if (
        this.activeEditor &&
        event.document.uri.path === this.activeEditor.document.uri.path &&
        event.document.uri.scheme === "file"
      ) {
        this.logger.appendLine("onDidChangeTextDocument");
        this.decorators.get(this.activeEditor)?.contentChange();
      }
    } catch (e) {
      this.prompt(e);
    }
  }

  onDidChangeConfiguration(e: vscode.ConfigurationChangeEvent) {
    try {
      if (e.affectsConfiguration("dim")) {
        this.config.invalidate();
        vscode.window.visibleTextEditors.forEach((editor) => {
          this.decorators.get(editor)?.configChange();
        });
      }
    } catch (e) {
      this.prompt(e);
    }
  }

  onCommandReceiveDisableDimForCurrentEditor() {
    try {
      if (this.activeEditor) {
        const ad = this.decorators.get(this.activeEditor);
        if (ad) {
          ad.disable();
          // needs to store toggle state separately as vscode doesn't necessarily
          // reuse the same instance of TextEditor for same document when user
          // returns after switching tabs
          this.documentState.set(this.activeEditor.document.uri.toString(false), ad.isEnabled());
        }
      }
    } catch (e) {
      this.prompt(e);
    }
  }

  onCommandReceiveEnableDimForCurrentEditor() {
    try {
      if (this.activeEditor) {
        const ad = this.decorators.get(this.activeEditor);
        if (ad) {
          ad.enable();
          this.documentState.set(this.activeEditor.document.uri.toString(false), ad.isEnabled()); // read comment above
        }
      }
    } catch (e) {
      this.prompt(e);
    }
  }

  onCommandReceiveToggleDimForCurrentEditor() {
    try {
      if (!this.activeEditor) return;
      const ad = this.decorators.get(this.activeEditor);
      if (ad) {
        ad.toggle();
        this.documentState.set(this.activeEditor.document.uri.toString(false), ad.isEnabled()); // read comment above
      }
    } catch (e) {
      this.prompt(e);
    }
  }

  onDidChangeTextEditorSelection(event: vscode.TextEditorSelectionChangeEvent) {
    try {
      if (this.activeEditor && this.activeEditor === event.textEditor) {
        this.decorators.get(this.activeEditor)?.selectionChange();
      }
    } catch (e) {
      this.prompt(e);
    }
  }

  destroy() {
    try {
      for (const editor of vscode.window.visibleTextEditors) {
        this.decorators.get(editor)?.disable();
      }
    } catch (e) {
      this.prompt(e);
    }
  }
}

let c: ExtensionLifecycleController;

export function activate(context: vscode.ExtensionContext) {
  c = new ExtensionLifecycleController(context);
}

export function deactivate() {
  c.destroy();
}
