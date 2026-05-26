import * as vscode from "vscode";
import * as cm from "./configManager";
import * as models from "./models";
import * as config from "./config";
import * as documents from "./documents";
import { now } from "./utils";

const tiers = [config.Opacity.Min, config.Opacity.Mid, config.Opacity.Max];

export interface Options {
  enabled: boolean;
  logname: string;
}

export class Controller {
  private editor: vscode.TextEditor;
  private config: cm.Cache;
  private logger: vscode.OutputChannel;
  private enabled: boolean; // local proxy for per-doc toggle
  private logname: string;
  private inSessionForConfigEdit: boolean; // don't pass selected areas

  private lastUpdateTimestamp: number;
  private timeoutForScheduler: NodeJS.Timeout | undefined;

  private document: documents.Controller;

  constructor(te: vscode.TextEditor, dc: documents.Controller, cc: cm.Cache, opts: Options, l: vscode.OutputChannel) {
    this.editor = te;
    this.config = cc;
    this.logger = l;
    this.enabled = opts.enabled;
    this.logname = opts.logname;
    this.document = dc;
    this.inSessionForConfigEdit = false;
    this.lastUpdateTimestamp = 0;
    this.log(`constructor (enabled: ${opts.enabled})`);
    this.schedule();
  }

  private log(message: string) {
    this.logger.appendLine(`${now()} editor(${this.logname}): ${message}`);
  }

  private isInOneOfSelectedAreas(range: vscode.Range): boolean {
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

  private decorateTier(config: models.Config, op: config.Opacity) {
    let matches = this.matchesFor(op);
    matches = this.mergeIntersecting(matches);
    if (!this.inSessionForConfigEdit) {
      matches = matches.filter((range) => !this.isInOneOfSelectedAreas(range));
    }
    this.editor.setDecorations(config.decoTypes[op], matches);
  }

  private decorate() {
    this.log(`decorating...`);
    const start = Date.now();

    const config = this.config.for(this.editor.document);
    for (const op of tiers) {
      this.decorateTier(config, op);
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
    const config = this.config.for(this.editor.document);
    this.editor.setDecorations(config.decoTypes.max, []);
    this.editor.setDecorations(config.decoTypes.mid, []);
    this.editor.setDecorations(config.decoTypes.min, []);
  }

  startConfigSession() {
    this.log("started to ignore selected areas during config edit");
    this.inSessionForConfigEdit = true;
    this.schedule();
  }

  endConfigSession() {
    this.log("ended to ignore selected areas during config edit");
    this.inSessionForConfigEdit = false;
    this.schedule();
  }
}
