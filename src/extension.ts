import * as vscode from "vscode";
import * as documents from "./documents";
import * as editors from "./editors";
import * as cm from "./configManager";
import { filename, now } from "./utils";

function isFile(te: vscode.TextEditor | undefined): boolean {
  return te !== undefined && te.document.uri.scheme === "file" && filename(te.document.uri) !== "settings.json";
}

function isConfig(te: vscode.TextEditor | undefined): boolean {
  return te !== undefined && te.document.uri.scheme === "file" && filename(te.document.uri) === "settings.json";
}

class LifecycleController {
  private config: cm.Cache;
  private documents: Map<string, documents.Controller>;
  private documentState: Map<string, boolean>; // per-doc toggle
  private editors: Map<vscode.TextEditor, editors.Controller>;
  private logger: vscode.OutputChannel;
  private editingConfig: boolean;

  constructor(context: vscode.ExtensionContext) {
    this.logger = vscode.window.createOutputChannel("dim", "log");
    this.log(`init`);

    this.config = new cm.Cache(this.logger);
    this.documents = new Map();
    this.documentState = new Map();
    this.editors = new Map();
    this.editingConfig = false;

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

    this.visibleEditorsChanged(vscode.window.visibleTextEditors);
  }

  prompt(e: unknown) {
    vscode.window.showWarningMessage(`Dim: ${e}`);
  }

  log(message: string) {
    this.logger.appendLine(`${now()} extension: ${message}`);
  }

  documentOpened(td: vscode.TextDocument) {
    if (td.uri.scheme === "file" && filename(td.uri) !== "settings.json") {
      this.log(`event received: document opened: ${filename(td.uri)}`);
      const dc = new documents.Controller(this.logger, td, this.config);
      this.documents.set(td.uri.toString(), dc);
    }
  }

  documentClosed(td: vscode.TextDocument) {
    if (td.uri.scheme === "file" && filename(td.uri) !== "settings.json") {
      this.log(`event received: document closed: ${filename(td.uri)}`);
      this.documents.delete(td.uri.toString());
    }
  }

  documentContentChanged(event: vscode.TextDocumentChangeEvent) {
    try {
      if (
        vscode.window.activeTextEditor &&
        event.document.uri.path === vscode.window.activeTextEditor.document.uri.path &&
        event.document.uri.scheme === "file"
      ) {
        this.log(`event received: document content changed`);
        this.editors.get(vscode.window.activeTextEditor)?.contentChange();
      }
    } catch (e) {
      this.prompt(e);
    }
  }

  editorAppeared(te: vscode.TextEditor) {
    this.log(`event received: editor appeared: ${filename(te.document.uri)}`);
    const td = this.documents.get(te.document.uri.toString());
    if (!td) {
      this.log("expected its document before editor");
      return;
    }
    const ec = new editors.Controller(te, td, this.config, true, this.logger);
    this.editors.set(te, ec);
  }

  editorDisappeared(te: vscode.TextEditor) {
    this.log(`event received: editor disappeared: ${filename(te.document.uri)}`);
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
          }
        }
      }
      const next = new Set(tes);
      for (const [te] of this.editors) {
        if (!next.has(te)) {
          if (isFile(te)) {
            this.editorDisappeared(te);
          }
        }
      }
      let editingConfig = false;
      for (const te of tes) if (isConfig(te)) editingConfig = true;
      if (editingConfig && !this.editingConfig) this.configEditorAppeared();
      else if (!editingConfig && this.editingConfig) this.configEditorDisappeared();
      this.editingConfig = editingConfig;
    } catch (e) {
      this.prompt(e);
    }
  }

  configChanged(e: vscode.ConfigurationChangeEvent) {
    try {
      if (e.affectsConfiguration("dim")) {
        this.log(`event received: extension configuration change`);
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
        const uri = vscode.window.activeTextEditor.document.uri;
        for (const [te, ec] of this.editors) {
          if (te.document.uri === uri) {
            ec.disable();
          }
        }
        this.documentState.set(uri.toString(), false);
      }
    } catch (e) {
      this.prompt(e);
    }
  }

  enableForDocument() {
    this.log(`event received: enable Dim for current editor`);
    try {
      if (vscode.window.activeTextEditor) {
        const uri = vscode.window.activeTextEditor.document.uri;
        for (const [te, ec] of this.editors) {
          if (te.document.uri === uri) {
            ec.enable();
          }
        }
        this.documentState.set(uri.toString(), true);
      }
    } catch (e) {
      this.prompt(e);
    }
  }

  toggleForDocument() {
    this.log(`event received: toggle Dim for current editor`);
    try {
      if (vscode.window.activeTextEditor) {
        const uri = vscode.window.activeTextEditor.document.uri;
        const state = this.documentState.get(uri.toString()) ?? true;
        const next = !state;
        for (const [te, ec] of this.editors) {
          if (te.document.uri === uri) {
            if (next) ec.enable();
            else ec.disable();
          }
        }
        this.documentState.set(uri.toString(), next);
      }
    } catch (e) {
      this.prompt(e);
    }
  }

  selectionsChanged(event: vscode.TextEditorSelectionChangeEvent) {
    try {
      if (vscode.window.activeTextEditor && vscode.window.activeTextEditor === event.textEditor) {
        this.log(`event received: selections changed`);
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
