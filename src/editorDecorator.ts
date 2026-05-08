import * as vscode from "vscode";
import * as cm from "./configManager";
import * as models from "./models";

function now(): string {
  return new Date().toISOString();
}

export function sprintPos(pos: vscode.Position): string {
  return `${pos.line + 1}:${pos.character + 1}`;
}

export function sprintRange(range: vscode.Range): string {
  return `[${sprintPos(range.start)}, ${sprintPos(range.end)}]`;
}

export class EditorDecorator {
  private editor: vscode.TextEditor;
  private config: models.Config;
  private configManager: cm.Cache;
  private filename: string;
  private logger: vscode.OutputChannel;
  private matches: Map<models.Rule, vscode.Range[]> | undefined;
  private decoTypes: models.DecorationTypes | undefined;
  private enabled: boolean;
  private inFocus: boolean;

  private lastUpdateTimestamp: number;
  private timeoutForScheduler: NodeJS.Timeout | undefined;

  constructor(editor: vscode.TextEditor, cm: cm.Cache, enabled: boolean, logger: vscode.OutputChannel) {
    this.editor = editor;
    this.configManager = cm;
    this.logger = logger;
    this.enabled = enabled;
    this.inFocus = true;
    this.filename = editor.document.fileName.split("/").pop() ?? "";
    this.lastUpdateTimestamp = 0;
    this.logger.appendLine(`${now()} editorDecorator: ${this.filename}: constructor (enabled: ${enabled})`);
    this.config = this.configManager.for(this.editor);
    this.withConfig();
  }

  private withConfig() {
    if (this.decoTypes) this.disposeLastDecorations();
    this.decoTypes = {
      "max": vscode.window.createTextEditorDecorationType({
        "opacity": this.config.valueForMaxTier.toString(),
        "isWholeLine": false,
      }),
      "mid": vscode.window.createTextEditorDecorationType({
        "opacity": this.config.valueForMidTier.toString(),
        "isWholeLine": false,
      }),
      "min": vscode.window.createTextEditorDecorationType({
        "opacity": this.config.valueForMinTier.toString(),
        "isWholeLine": false,
      }),
    } as models.DecorationTypes;
  }

  private doBracesMatch(text: string, start: number, end: number): boolean {
    let balance = 0;
    for (let i = start; i < Math.min(text.length, end); i++) {
      if (text[i] === "{") balance++;
      if (text[i] === "}") balance--;
    }
    return balance === 0;
  }

  private isInOneOfSelectedAreas(range: vscode.Range): boolean {
    if (!this.inFocus) return false;
    if (!this.editor.selections) return false;
    for (const selection of this.editor.selections) {
      if (selection.intersection(range)) return true;
    }
    return false;
  }

  private scanForRule(range: vscode.Range, rule: models.Rule): vscode.Range[] {
    this.logger.appendLine(`${now()} editorDecorator: ${this.filename}: scanning for: ${rule.regex}`);
    const ranges: vscode.Range[] = [];
    const text = this.editor.document.getText(range);
    Array.from(text.matchAll(rule.regex)).forEach((match) => {
      if (!match.index || !match[0]) return;
      const start = match.index;
      const end = start + match[0].length;
      const range = new vscode.Range(this.editor.document.positionAt(start), this.editor.document.positionAt(end));
      if (this.doBracesMatch(text, start, end)) {
        this.logger.appendLine(
          `${now()} editorDecorator: ${this.filename}: scanning for: ${rule.regex}: found: ${sprintRange(range)}`,
        );
        ranges.push(range);
      }
    });
    return ranges;
  }

  private scanForRules() {
    const range = this.editor.document.validateRange(
      new vscode.Range(new vscode.Position(0, 0), new vscode.Position(2000, 0)),
    );
    this.logger.appendLine(`${now()} editorDecorator: ${this.filename}: scanning lines: ${sprintRange(range)}`);
    this.matches = new Map() as Map<models.Rule, vscode.Range[]>;
    for (const rule of this.config.rules) {
      this.matches.set(rule, this.scanForRule(range, rule));
    }
  }

  private disposeLastDecorations() {
    this.logger.appendLine(`${now()} editorDecorator: ${this.filename}: disposing previous decorations`);
    if (!this.decoTypes) return;
    this.editor.setDecorations(this.decoTypes.max, []);
    this.editor.setDecorations(this.decoTypes.mid, []);
    this.editor.setDecorations(this.decoTypes.min, []);
  }

  private mergeIntersecting(queue: vscode.Range[]): vscode.Range[] {
    if (queue.length <= 1) return queue;
    this.logger.appendLine(`${now()} editorDecorator: merging ${queue.length} matches...`);
    const sorted = queue.sort((a, b) => {
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
    this.logger.appendLine(`${now()} editorDecorator: merged to ${merged.length} matches`);
    return merged;
  }

  private createDecorationQueues(): models.PerDecorationQueue | undefined {
    if (!this.matches) return;
    const queues = {
      "max": [] as vscode.Range[],
      "mid": [] as vscode.Range[],
      "min": [] as vscode.Range[],
    };
    for (const rule of this.config.rules) {
      const matchesForRule = this.matches.get(rule);
      if (matchesForRule) {
        for (const match of matchesForRule) {
          queues[rule.opacity].push(match);
        }
      }
    }
    return {
      "max": this.mergeIntersecting(queues.max.filter((range) => !this.isInOneOfSelectedAreas(range))),
      "mid": this.mergeIntersecting(queues.mid.filter((range) => !this.isInOneOfSelectedAreas(range))),
      "min": this.mergeIntersecting(queues.min.filter((range) => !this.isInOneOfSelectedAreas(range))),
    };
  }

  private applyNewDecorations() {
    if (!this.decoTypes) return;
    if (!this.matches) return;
    const queues = this.createDecorationQueues();
    if (!queues) return;
    this.editor.setDecorations(this.decoTypes.max, queues.max);
    this.editor.setDecorations(this.decoTypes.mid, queues.mid);
    this.editor.setDecorations(this.decoTypes.min, queues.min);
  }

  private decorateEditor() {
    this.logger.appendLine(`${now()} editorDecorator: ${this.filename}: decorating...`);
    const start = Date.now();
    if (!this.matches) this.scanForRules();
    this.applyNewDecorations();
    this.logger.appendLine(`${now()} editorDecorator: ${this.filename}: decorated (${Date.now() - start}ms)`);
  }

  private schedule() {
    if (!this.enabled) {
      this.logger.appendLine(
        `${now()} editorDecorator: ${this.filename}: skipping update because Dim is disabled for this editor`,
      );
      return;
    }
    const period = this.config.updatePeriod;
    const isSchedulingNecessary = Date.now() - this.lastUpdateTimestamp < period;

    if (!isSchedulingNecessary) {
      this.decorateEditor();
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
    this.logger.appendLine(`${now()} editorDecorator: ${this.filename}: blur`);
    this.inFocus = false;
  }

  focus() {
    this.logger.appendLine(`${now()} editorDecorator: ${this.filename}: focus`);
    this.inFocus = true;
    this.schedule();
  }

  contentChange() {
    this.logger.appendLine(`${now()} editorDecorator: ${this.filename}: content change`);
    this.matches = undefined;
    this.schedule();
  }

  selectionChange() {
    this.logger.appendLine(`${now()} editorDecorator: ${this.filename}: selection change`);
    this.schedule();
  }

  configChange() {
    this.logger.appendLine(`${now()} editorDecorator: ${this.filename}: configuration change`);
    this.config = this.configManager.for(this.editor);
    this.matches = undefined;
    this.withConfig();
    this.schedule();
  }

  enable() {
    this.logger.appendLine(`${now()} editorDecorator: ${this.filename}: enabling...`);
    this.enabled = true;
    this.matches = undefined;
    this.schedule();
  }

  disable() {
    this.logger.appendLine(`${now()} editorDecorator: ${this.filename}: disabling...`);
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
