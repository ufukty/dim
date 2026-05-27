import * as vscode from "vscode";
import * as cm from "./configManager";
import * as models from "./models";
import { filename, now } from "./utils";

export function sprintPos(pos: vscode.Position): string {
  return `${pos.line + 1}:${pos.character + 1}`;
}

export function sprintRange(range: vscode.Range): string {
  return `[${sprintPos(range.start)}, ${sprintPos(range.end)}]`;
}

function braceBalance(text: string, start: number, end: number): boolean {
  let balance = 0;
  for (let i = start; i < Math.min(text.length, end); i++) {
    if (text[i] === "{") balance++;
    if (text[i] === "}") balance--;
  }
  return balance === 0;
}

export class Controller {
  private matches: Map<models.Rule, vscode.Range[]> | undefined;
  private logger: vscode.OutputChannel;
  private document: vscode.TextDocument;
  private config: cm.Cache;

  constructor(logger: vscode.OutputChannel, doc: vscode.TextDocument, config: cm.Cache) {
    this.logger = logger;
    this.matches = undefined;
    this.document = doc;
    this.config = config;
  }

  private log(message: string) {
    this.logger.appendLine(`${now()} document(${filename(this.document.uri)}): ${message}`);
  }

  private rule(range: vscode.Range, rule: models.Rule): vscode.Range[] {
    this.log(`scanning for: ${rule.regex}...`);
    const ranges: vscode.Range[] = [];
    const text = this.document.getText(range);
    for (const match of text.matchAll(rule.regex)) {
      if (!match.index || !match[0]) continue;
      const start = match.index;
      const end = match.index + match[0].length;
      if (rule.max > 0 && end - start > rule.max) continue;
      if (braceBalance(text, start, end)) {
        ranges.push(new vscode.Range(this.document.positionAt(start), this.document.positionAt(end)));
      }
    }
    this.log(`found: ${ranges.map(sprintRange).join(", ")}`);
    return ranges;
  }

  private rules(): Map<models.Rule, vscode.Range[]> {
    const range = this.document.validateRange(
      new vscode.Range(new vscode.Position(0, 0), new vscode.Position(2000, 0)),
    );
    this.log(`scanning lines: ${sprintRange(range)}`);
    const matches = new Map<models.Rule, vscode.Range[]>();
    for (const rule of this.config.for(this.document).rules) {
      matches.set(rule, this.rule(range, rule));
    }
    return matches;
  }

  get(): Map<models.Rule, vscode.Range[]> {
    if (!this.matches) {
      this.matches = this.rules();
    }
    return this.matches;
  }

  invalidate() {
    this.matches = undefined;
  }
}
