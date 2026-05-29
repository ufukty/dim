import * as vscode from "vscode";
import * as documents from "./documents";
import * as editors from "./editors";
import * as cm from "./configManager";
import { filename, now } from "./utils";

function isFile(td: vscode.TextDocument): boolean {
  return td.uri.scheme === "file" && filename(td.uri) !== "settings.json";
}

function isForFile(te: vscode.TextEditor | undefined): boolean {
  return te !== undefined && isFile(te.document);
}

function isUserConfig(uri: vscode.Uri): boolean {
  return uri.scheme === "vscode-userdata" && filename(uri) === "settings.json";
}

function isWorkspaceConfig(uri: vscode.Uri): boolean {
  if (uri.scheme !== "file") {
    return false;
  }
  const workspaceRoot = vscode.workspace.getWorkspaceFolder(uri);
  if (workspaceRoot === undefined) {
    return false;
  }
  const workspaceConfig = vscode.Uri.joinPath(workspaceRoot.uri, ".vscode", "settings.json");
  return uri.toString() === workspaceConfig.toString();
}

function isConfig(td: vscode.TextDocument): boolean {
  return isUserConfig(td.uri) || isWorkspaceConfig(td.uri);
}

function isForConfig(te: vscode.TextEditor | undefined): boolean {
  return te !== undefined && isConfig(te.document);
}

class LifecycleController {
  private config: cm.Cache;
  private documents: Map<string, documents.Controller>;
  private documentState: Map<string, boolean>; // per-doc toggle
  private editors: Map<vscode.TextEditor, editors.Controller>;
  private editorCount: number;
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
    this.editorCount = 0;

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

      vscode.workspace.onDidRenameFiles(this.documentRenamed, this),
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

  error(message: string) {
    this.logger.appendLine(`${now()} [error] extension: ${message}`);
  }

  documentOpened(td: vscode.TextDocument) {
    if (isFile(td)) {
      this.log(`event received: document opened: ${filename(td.uri)}`);
      const dc = new documents.Controller(this.logger, td, this.config);
      this.documents.set(td.uri.toString(), dc);
    }
  }

  documentRenamed(e: vscode.FileRenameEvent) {
    for (const file of e.files) {
      const [prev, next] = [file.oldUri.toString(), file.newUri.toString()];
      const state = this.documentState.get(prev) ?? true;
      if (state !== undefined) {
        this.documentState.delete(prev);
        if (!state) this.documentState.set(next, false);
      }
    }
  }

  documentClosed(td: vscode.TextDocument) {
    if (isFile(td)) {
      this.log(`event received: document closed: ${filename(td.uri)}`);
      this.documents.delete(td.uri.toString());
    }
  }

  documentContentChanged(event: vscode.TextDocumentChangeEvent) {
    try {
      if (vscode.window.activeTextEditor && isFile(event.document)) {
        this.log(`event received: document content changed`);
        const uri = vscode.window.activeTextEditor.document.uri;
        const dc = this.documents.get(uri.toString());
        if (!dc) {
          this.error("expected controller for the document whose contents is changed");
          return;
        }
        dc.invalidate();
        for (const [te, ec] of this.editors) {
          if (te.document.uri === uri) {
            ec.contentChange();
          }
        }
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
    const enabled = this.documentState.get(te.document.uri.toString()) ?? true;
    const opts = <editors.Options>{
      enabled: enabled,
      logname: `${this.editorCount++}/${filename(te.document.uri)}`,
    };
    const ec = new editors.Controller(te, td, this.config, opts, this.logger);
    this.editors.set(te, ec);
  }

  editorDisappeared(te: vscode.TextEditor) {
    this.log(`event received: editor disappeared: ${filename(te.document.uri)}`);
    this.editors.delete(te);
  }

  configEditorAppeared() {
    this.log("config editor appeared. the extension will pause on skipping selected areas");
    for (const [, ec] of this.editors) {
      ec.startConfigSession();
    }
  }

  configEditorDisappeared() {
    this.log("config editor disappeared. the extension will continue to skip selected areas");
    for (const [, ec] of this.editors) {
      ec.endConfigSession();
    }
  }

  visibleEditorsChanged(tes: readonly vscode.TextEditor[]) {
    try {
      const appeared = tes.filter((te) => !this.editors.has(te));
      const next = new Set(tes);
      const disappeared = Array.from(this.editors.keys()).filter((te) => !next.has(te));
      if (appeared.length > 0 || disappeared.length > 0) {
        this.log("event received: visible editors changed");
        for (const te of appeared) {
          if (isForFile(te)) {
            this.editorAppeared(te);
          }
        }
        for (const te of disappeared) {
          if (isForFile(te)) {
            this.editorDisappeared(te);
          }
        }

        const editingConfig = tes.some((te) => isForConfig(te));
        this.log(`editingConfig: ${editingConfig}`);
        if (editingConfig && !this.editingConfig) this.configEditorAppeared();
        else if (!editingConfig && this.editingConfig) this.configEditorDisappeared();
        this.editingConfig = editingConfig;
      }
    } catch (e) {
      this.prompt(e);
    }
  }

  configChanged(e: vscode.ConfigurationChangeEvent) {
    try {
      if (e.affectsConfiguration("dim")) {
        this.log(`event received: extension configuration change`);
        this.config.invalidate();
        for (const [, dc] of this.documents) {
          dc.invalidate();
        }
        for (const [, ec] of this.editors) {
          ec.configChange();
        }
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
        this.documentState.delete(uri.toString());
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
        if (next) this.documentState.delete(uri.toString());
        else this.documentState.set(uri.toString(), false);
      }
    } catch (e) {
      this.prompt(e);
    }
  }

  selectionsChanged(event: vscode.TextEditorSelectionChangeEvent) {
    try {
      if (isForFile(event.textEditor)) {
        this.log(`event received: selections changed`);
        this.editors.get(event.textEditor)?.selectionChange();
      }
    } catch (e) {
      this.prompt(e);
    }
  }

  destroy() {
    this.log(`destroy`);
    try {
      for (const [, ec] of this.editors) {
        ec.disable();
      }
      this.config.invalidate();
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
