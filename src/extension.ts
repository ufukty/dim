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
      vscode.commands.registerCommand("dim.disableDimForCurrentEditor", this.disableForDocument, this),
      vscode.commands.registerCommand("dim.enableDimForCurrentEditor", this.enableForDocument, this),
      vscode.commands.registerCommand("dim.toggleDimForCurrentEditor", this.toggleForDocument, this),
      
      vscode.window.onDidChangeVisibleTextEditors(this.visibleEditorsChanged, this),
      
      vscode.window.onDidChangeTextEditorSelection(this.selectionsChanged, this),
      
      vscode.workspace.onDidChangeConfiguration(this.configChanged, this),

      vscode.workspace.onDidOpenTextDocument(this.documentOpened, this),
      vscode.workspace.onDidChangeTextDocument(this.documentContentChanged, this),
      vscode.workspace.onDidCloseTextDocument(this.documentClosed, this),
    );

    for (const td of vscode.workspace.textDocuments) {
      this.documentOpened(td);
    }

    for (const te of vscode.window.visibleTextEditors) {
      this.editorAppeared(te);
    }
  }

  prompt(e: unknown) {
    vscode.window.showWarningMessage(`Dim: ${e}`);
  }

  log(message: string) {
    this.logger.appendLine(`${now()} extension: ${message}`);
  }

  documentOpened(td: vscode.TextDocument) {
    const dc = new documents.Controller(this.logger, td, this.config);
    this.documents.set(td.uri.toString(), dc);
  }

  documentClosed(doc: vscode.TextDocument) {
    this.documents.delete(doc.uri.toString());
  }

  documentContentChanged(event: vscode.TextDocumentChangeEvent) {
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

  editorAppeared(te: vscode.TextEditor) {
    const td = this.documents.get(te.document.uri.toString());
    if (!td) {
      this.log("expected its document before editor");
      return;
    }
    const ec = new editors.Controller(te, td, this.config, true, this.logger);
    this.editors.set(te, ec);
  }

  editorDisappeared(te: vscode.TextEditor) {
    this.editors.delete(te);
  }

  configEditorAppeared() {
    this.log("config editor appeared. the extension will dim selected areas");
    for (const [, ec] of this.editors) {
      ec.startConfigSession();
    }
  }

  configEditorDisappeared() {
    this.log("config editor appeared. the extension will ignore selected areas");
    for (const [, ec] of this.editors) {
      ec.endConfigSession();
    }
  }

  visibleEditorsChanged(tes: readonly vscode.TextEditor[]) {
    this.log("event received: visible editors changed");
    try {
      for (const te of tes) {
        if (!this.editors.has(te)) {
          if (isFile(te)) {
            this.editorAppeared(te);
          } else if (isConfig(te)) {
            this.configEditorAppeared();
          }
        }
      }
      const next = new Set(tes);
      for (const [te] of this.editors) {
        if (!next.has(te)) {
          if (isFile(te)) {
            this.editorDisappeared(te);
          } else if (isConfig(te)) {
            this.configEditorDisappeared();
          }
        }
      }
    } catch (e) {
      this.prompt(e);
    }
  }

  configChanged(e: vscode.ConfigurationChangeEvent) {
    this.log(`event received: configuration change: ${e?.affectsConfiguration}`);
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

  disableForDocument() {
    this.log(`event received: disable Dim for current editor`);
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

  enableForDocument() {
    this.log(`event received: enable Dim for current editor`);
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

  toggleForDocument() {
    this.log(`event received: toggle Dim for current editor`);
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

  selectionsChanged(event: vscode.TextEditorSelectionChangeEvent) {
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
