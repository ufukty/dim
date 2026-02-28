import * as vscode from "vscode";
import { EditorDecorator } from "./editorDecorator";
import { ConfigManager } from "./configmanager";

class ExtensionLifecycleController {
  decorators: Map<vscode.TextEditor, EditorDecorator>;
  logger: vscode.OutputChannel;
  activeEditor: vscode.TextEditor | undefined;
  configManager: ConfigManager;
  documentState: Map<string, boolean>; // <editor.document.uri: boolean>
  context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;

    this.logger = vscode.window.createOutputChannel("dim");
    this.logger.appendLine("init");

    this.decorators = new Map();
    this.configManager = new ConfigManager();
    this.documentState = new Map<string, boolean>();

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "dim.disableDimForCurrentEditor",
        this.onCommandReceiveDisableDimForCurrentEditor,
      ),
      vscode.commands.registerCommand("dim.enableDimForCurrentEditor", this.onCommandReceiveEnableDimForCurrentEditor),
      vscode.commands.registerCommand("dim.toggleDimForCurrentEditor", this.onCommandReceiveToggleDimForCurrentEditor),
    );

    vscode.workspace.onDidChangeConfiguration((e: vscode.ConfigurationChangeEvent) => {
      this.onDidChangeConfiguration(e);
    });

    vscode.window.onDidChangeActiveTextEditor((editor) => {
      this.onDidChangeActiveTextEditor(editor);
    });

    vscode.workspace.onDidChangeTextDocument((event) => {
      this.onDidChangeTextDocument(event);
    });

    vscode.window.visibleTextEditors.forEach((editor) => {
      this.onDidChangeActiveTextEditor(editor);
    });

    vscode.window.onDidChangeTextEditorSelection((event) => {
      this.onDidChangeTextEditorSelection(event);
    });

    if (vscode.window.activeTextEditor) {
      this.activeEditor = vscode.window.activeTextEditor;
    }
  }

  onDidChangeActiveTextEditor(editor: vscode.TextEditor | undefined): any {
    if (this.activeEditor) {
      var d = this.decorators.get(this.activeEditor);
      if (d) {
        d.blur();
      }
    }

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
      d = this.decorators.get(this.activeEditor);
      if (!d) {
        const uri = this.activeEditor.document.uri.toString(false);
        let enabled = this.documentState.get(uri);
        if (enabled === undefined) {
          enabled = true;
        }
        d = new EditorDecorator(this.activeEditor, this.configManager, enabled, this.logger);
        this.decorators.set(this.activeEditor, d);
      }
      d.focus();
    }
  }

  onDidChangeTextDocument(event: vscode.TextDocumentChangeEvent): any {
    if (!this.activeEditor) return;
    if (event.document.uri.path !== this.activeEditor.document.uri.path || event.document.uri.scheme !== "file") return;
    this.logger.appendLine("onDidChangeTextDocument");

    const uri = this.activeEditor.document.uri.toString(false);
    const d = this.decorators.get(this.activeEditor);
    if (d) {
      d.contentChange();
    }
  }

  onDidChangeConfiguration(e: vscode.ConfigurationChangeEvent) {
    if (!e.affectsConfiguration("dim")) return;
    this.configManager.clearConfigCache(e);
    vscode.window.visibleTextEditors.forEach((editor) => {
      const ad = this.decorators.get(editor);
      if (ad) {
        ad.configChange();
      }
    });
  }

  onCommandReceiveDisableDimForCurrentEditor() {
    if (!this.activeEditor) return;
    const ad = this.decorators.get(this.activeEditor);
    if (ad) {
      ad.disable();
      // needs to store toggle state separately as vscode doesn't necessarily
      // reuse the same instance of TextEditor for same document when user
      // returns after switching tabs
      this.documentState.set(this.activeEditor.document.uri.toString(false), ad.isEnabled());
    }
  }

  onCommandReceiveEnableDimForCurrentEditor() {
    if (!this.activeEditor) return;
    const ad = this.decorators.get(this.activeEditor);
    if (ad) {
      ad.enable();
      this.documentState.set(this.activeEditor.document.uri.toString(false), ad.isEnabled()); // read comment above
    }
  }

  onCommandReceiveToggleDimForCurrentEditor() {
    if (!this.activeEditor) return;
    const ad = this.decorators.get(this.activeEditor);
    if (ad) {
      ad.toggle();
      this.documentState.set(this.activeEditor.document.uri.toString(false), ad.isEnabled()); // read comment above
    }
  }

  onDidChangeTextEditorSelection(event: vscode.TextEditorSelectionChangeEvent) {
    if (!this.activeEditor || this.activeEditor !== event.textEditor) return;
    const ad = this.decorators.get(this.activeEditor);
    if (ad) {
      ad.selectionChange();
    }
  }

  destroy() {
    for (const editor of vscode.window.visibleTextEditors) {
      var ad = this.decorators.get(editor);
      if (ad) {
        ad.disable();
      }
    }
  }
}

var c: ExtensionLifecycleController;

export function activate(context: vscode.ExtensionContext) {
  c = new ExtensionLifecycleController(context);
}

export function deactivate() {
  c.destroy();
}
