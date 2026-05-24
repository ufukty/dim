import * as vscode from "vscode";
import * as documents from "./documents";
import * as editors from "./editors";
import * as cm from "./configManager";

function now(): string {
  return new Date().toISOString();
}

function isFile(te: vscode.TextEditor | undefined): boolean {
  return (
    te !== undefined && te.document.uri.scheme === "file" && te.document.uri.path.split("/").pop() !== "settings.json"
  );
}

function isConfig(te: vscode.TextEditor | undefined): boolean {
  return (
    te !== undefined && te.document.uri.scheme === "file" && te.document.uri.path.split("/").pop() === "settings.json"
  );
}

class LifecycleController {
  private config: cm.Cache;
  private documents: Map<string, documents.Controller>;
  private documentState: Map<string, boolean>; // per-doc toggle
  private editors: Map<vscode.TextEditor, editors.Controller>;
  private logger: vscode.OutputChannel;

  constructor(context: vscode.ExtensionContext) {
    this.logger = vscode.window.createOutputChannel("dim");
    this.log(`init`);

    this.config = new cm.Cache(this.logger);
    this.documents = new Map();
    this.documentState = new Map();
    this.editors = new Map();

    /* prettier-ignore */
    context.subscriptions.push(
      vscode.commands.registerCommand("dim.disableDimForCurrentEditor", this.onCommandReceiveDisableDimForCurrentEditor, this),
      vscode.commands.registerCommand("dim.enableDimForCurrentEditor", this.onCommandReceiveEnableDimForCurrentEditor, this),
      vscode.commands.registerCommand("dim.toggleDimForCurrentEditor", this.onCommandReceiveToggleDimForCurrentEditor, this),
      
      vscode.window.onDidChangeVisibleTextEditors(this.onDidChangeVisibleTextEditors, this),
      
      vscode.window.onDidChangeTextEditorSelection(this.onDidChangeTextEditorSelection, this),
      
      vscode.workspace.onDidChangeConfiguration(this.onDidChangeConfiguration, this),

      vscode.workspace.onDidOpenTextDocument(this.onDidOpenTextDocument, this),
      vscode.workspace.onDidChangeTextDocument(this.onDidChangeTextDocument, this),
      vscode.workspace.onDidCloseTextDocument(this.onDidCloseTextDocument, this),
    );

    for (const td of vscode.workspace.textDocuments) {
      this.onDidOpenTextDocument(td);
    }

    for (const te of vscode.window.visibleTextEditors) {
      this.onDidAppearTextEditor(te);
    }
  }

  prompt(e: unknown) {
    vscode.window.showWarningMessage(`Dim: ${e}`);
  }

  log(message: string) {
    this.logger.appendLine(`${now()} extension: ${message}`);
  }

  onDidOpenTextDocument(td: vscode.TextDocument) {
    const dc = new documents.Controller(this.logger, td, this.config);
    this.documents.set(td.uri.toString(), dc);
  }

  onDidAppearTextEditor(te: vscode.TextEditor) {
    const td = this.documents.get(te.document.uri.toString());
    if (!td) {
      this.log("expected its document before editor");
      return;
    }
    const ec = new editors.Controller(te, td, this.config, true, this.logger);
    this.editors.set(te, ec);
  }

  onDidDisappearTextEditor(te: vscode.TextEditor) {
    this.editors.delete(te);
  }

  onDidAppearConfigEditor() {
    this.log("config editor appeared. the extension will dim selected areas");
    for (const [, ec] of this.editors) {
      ec.startConfigSession();
    }
  }

  onDidDisappearConfigEditor() {
    this.log("config editor appeared. the extension will ignore selected areas");
    for (const [, ec] of this.editors) {
      ec.endConfigSession();
    }
  }

  onDidChangeVisibleTextEditors(tes: readonly vscode.TextEditor[]) {
    try {
      for (const te of tes) {
        if (!this.editors.has(te)) {
          if (isFile(te)) {
            this.onDidAppearTextEditor(te);
          } else if (isConfig(te)) {
            this.onDidAppearConfigEditor();
          }
        }
      }
      const next = new Set(tes);
      for (const [te] of this.editors) {
        if (!next.has(te)) {
          if (isFile(te)) {
            this.onDidDisappearTextEditor(te);
          } else if (isConfig(te)) {
            this.onDidDisappearConfigEditor();
          }
        }
      }
    } catch (e) {
      this.prompt(e);
    }
  }

  onDidChangeTextDocument(event: vscode.TextDocumentChangeEvent) {
    try {
      if (
        vscode.window.activeTextEditor &&
        event.document.uri.path === vscode.window.activeTextEditor.document.uri.path &&
        event.document.uri.scheme === "file"
      ) {
        this.log(`onDidChangeTextDocument: ${event?.reason}`);
        this.editors.get(vscode.window.activeTextEditor)?.contentChange();
      }
    } catch (e) {
      this.prompt(e);
    }
  }

  onDidCloseTextDocument(doc: vscode.TextDocument) {
    this.documents.delete(doc.uri.toString());
  }

  onDidChangeConfiguration(e: vscode.ConfigurationChangeEvent) {
    this.log(`onDidChangeConfiguration: ${e?.affectsConfiguration}`);
    try {
      if (e.affectsConfiguration("dim")) {
        this.config.invalidate();
        vscode.window.visibleTextEditors.forEach((editor) => {
          this.editors.get(editor)?.configChange();
        });
      }
    } catch (e) {
      this.prompt(e);
    }
  }

  onCommandReceiveDisableDimForCurrentEditor() {
    this.log(`disableDimForCurrentEditor`);
    try {
      if (vscode.window.activeTextEditor) {
        const ad = this.editors.get(vscode.window.activeTextEditor);
        if (ad) {
          ad.disable();
          this.documentState.set(vscode.window.activeTextEditor.document.uri.toString(false), ad.isEnabled());
        }
      }
    } catch (e) {
      this.prompt(e);
    }
  }

  onCommandReceiveEnableDimForCurrentEditor() {
    this.log(`enableDimForCurrentEditor`);
    try {
      if (vscode.window.activeTextEditor) {
        const ad = this.editors.get(vscode.window.activeTextEditor);
        if (ad) {
          ad.enable();
          this.documentState.set(vscode.window.activeTextEditor.document.uri.toString(false), ad.isEnabled()); // read comment above
        }
      }
    } catch (e) {
      this.prompt(e);
    }
  }

  onCommandReceiveToggleDimForCurrentEditor() {
    this.log(`toggleDimForCurrentEditor`);
    try {
      if (!vscode.window.activeTextEditor) return;
      const ad = this.editors.get(vscode.window.activeTextEditor);
      if (ad) {
        ad.toggle();
        this.documentState.set(vscode.window.activeTextEditor.document.uri.toString(false), ad.isEnabled()); // read comment above
      }
    } catch (e) {
      this.prompt(e);
    }
  }

  onDidChangeTextEditorSelection(event: vscode.TextEditorSelectionChangeEvent) {
    try {
      if (vscode.window.activeTextEditor && vscode.window.activeTextEditor === event.textEditor) {
        this.log(`change selections: ${event?.kind}/${event?.selections?.length}`);
        this.editors.get(vscode.window.activeTextEditor)?.selectionChange();
      }
    } catch (e) {
      this.prompt(e);
    }
  }

  destroy() {
    this.log(`destroy`);
    try {
      for (const editor of vscode.window.visibleTextEditors) {
        this.editors.get(editor)?.disable();
      }
    } catch (e) {
      this.prompt(e);
    }
  }
}

let c: LifecycleController;

export function activate(context: vscode.ExtensionContext) {
  c = new LifecycleController(context);
}

export function deactivate() {
  c.destroy();
}
