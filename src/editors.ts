import * as vscode from "vscode";
import * as cm from "./configManager";
import * as models from "./models";
import * as config from "./config";
import * as documents from "./documents";

function now(): string {
  return new Date().toISOString();
}

export function sprintPos(pos: vscode.Position): string {
  return `${pos.line + 1}:${pos.character + 1}`;
}

export function sprintRange(range: vscode.Range): string {
  return `[${sprintPos(range.start)}, ${sprintPos(range.end)}]`;
}

function styles(config: models.Config): models.DecorationTypes {
  return {
    "max": vscode.window.createTextEditorDecorationType({
      "opacity": config.valueForMaxTier.toString(),
      "isWholeLine": false,
    }),
    "mid": vscode.window.createTextEditorDecorationType({
      "opacity": config.valueForMidTier.toString(),
      "isWholeLine": false,
    }),
    "min": vscode.window.createTextEditorDecorationType({
      "opacity": config.valueForMinTier.toString(),
      "isWholeLine": false,
    }),
  };
}

const tiers = [config.Opacity.Min, config.Opacity.Mid, config.Opacity.Max];

export class Controller {
  private editor: vscode.TextEditor;
  private config: cm.Cache;
  private filename: string;
  private logger: vscode.OutputChannel;
  private decoTypes: models.DecorationTypes | undefined;
  private enabled: boolean;
  private inFocus: boolean;

  private lastUpdateTimestamp: number;
  private timeoutForScheduler: NodeJS.Timeout | undefined;

  private document: documents.DocumentController;

  constructor(
    editor: vscode.TextEditor,
    doc: documents.DocumentController,
    config: cm.Cache,
    enabled: boolean,
    logger: vscode.OutputChannel,
  ) {
    this.editor = editor;
    this.config = config;
    this.logger = logger;
    this.enabled = enabled;
    this.document = doc;
    this.inFocus = true;
    this.filename = editor.document.fileName.split("/").pop() ?? "";
    this.lastUpdateTimestamp = 0;
    this.log(`constructor (enabled: ${enabled})`);
    this.withConfig();
  }

  private log(message: string) {
    this.logger.appendLine(`${now()} editorDecorator(${this.filename}): ${message}`);
  }

  private disposeLastDecorations() {
    this.log(`disposing previous decorations`);
    if (!this.decoTypes) return;
    this.editor.setDecorations(this.decoTypes.max, []);
    this.editor.setDecorations(this.decoTypes.mid, []);
    this.editor.setDecorations(this.decoTypes.min, []);
  }

  private withConfig() {
    if (this.decoTypes) this.disposeLastDecorations();
    this.decoTypes = styles(this.config.for(this.editor.document));
  }

  private isInOneOfSelectedAreas(range: vscode.Range): boolean {
    if (!this.inFocus) return false;
    if (!this.editor.selections) return false;
    for (const selection of this.editor.selections) {
      if (selection.intersection(range)) return true;
    }
    return false;
  }

  private matchesFor(op: config.Opacity) {
    const matches = this.document.get();
    const queue: vscode.Range[] = [];
    for (const [rule, ranges] of matches) {
      if (rule.opacity === op) {
        queue.push(...ranges);
      }
    }
    return queue;
  }

  private mergeIntersecting(matches: vscode.Range[]): vscode.Range[] {
    this.log(`merging ${matches.length} matches...`);
    if (matches.length <= 1) return matches;
    const sorted = matches.sort((a, b) => {
      if (a.end.isBeforeOrEqual(b.start)) return -1; //   no overlap:      aabb
      if (b.end.isBeforeOrEqual(a.start)) return 1; //    no overlap:      bbaa
      if (a.start.isBeforeOrEqual(b.start)) return -1; // partial overlap: abab
      if (b.start.isBeforeOrEqual(a.start)) return 1; //  partial overlap: baba
      return 0;
    });
    const merged = [] as vscode.Range[];
    let merging = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      if (!sorted[i].intersection(merging)) {
        merged.push(merging);
        merging = sorted[i];
      }
    }
    merged.push(merging);
    this.log(`merged down to ${matches.length}`);
    return merged;
  }

  private decorateTier(op: config.Opacity) {
    let matches = this.matchesFor(op);
    matches = this.mergeIntersecting(matches);
    matches = matches.filter((range) => !this.isInOneOfSelectedAreas(range));
    this.editor.setDecorations(this.decoTypes.max, matches);
  }

  private decorate() {
    this.log(`decorating...`);
    const start = Date.now();

    for (const op of tiers) {
      this.decorateTier(op);
    }

    this.log(`decorated (${Date.now() - start}ms)`);
  }

  private schedule() {
    if (!this.enabled) {
      this.log(`skipping update because Dim is disabled for this editor`);
      return;
    }
    const period = this.config.for(this.editor.document).updatePeriod;
    const isSchedulingNecessary = Date.now() - this.lastUpdateTimestamp < period;

    if (!isSchedulingNecessary) {
      this.decorate();
      this.lastUpdateTimestamp = Date.now();
    } else if (this.timeoutForScheduler === undefined) {
      const waitTime = period - (Date.now() - this.lastUpdateTimestamp);
      this.timeoutForScheduler = setTimeout(() => {
        this.schedule();
        this.timeoutForScheduler = undefined;
      }, waitTime);
    }
  }

  blur() {
    this.log(`blur`);
    this.inFocus = false;
  }

  focus() {
    this.log(`focus`);
    this.inFocus = true;
    this.schedule();
  }

  contentChange() {
    this.log(`content change`);
    this.schedule();
  }

  selectionChange() {
    this.log(`selection change`);
    this.schedule();
  }

  configChange() {
    this.log(`configuration change`);
    this.withConfig();
    this.schedule();
  }

  enable() {
    this.log(`enabling...`);
    this.enabled = true;
    this.schedule();
  }

  disable() {
    this.log(`disabling...`);
    this.enabled = false;
    this.disposeLastDecorations();
  }

  toggle() {
    if (this.enabled) this.disable();
    else this.enable();
  }

  isEnabled() {
    return this.enabled;
  }
}
