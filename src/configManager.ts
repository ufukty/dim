import * as vscode from "vscode";
import * as config from "./config";
import * as models from "./models";

type ScopeId = string;

class Scope {
  uri: vscode.Uri;
  languageId: string;

  constructor(editor: vscode.TextEditor) {
    this.uri = editor.document.uri;
    this.languageId = editor.document.languageId;
  }

  toString(): string {
    return `${this.uri.toString()} (${this.languageId})`;
  }

  internalize(): ScopeId {
    return `${this.uri.toString()}\u0000${this.languageId}`;
  }
}

class Reader {
  private concatRuleLayer(rules: config.Rule[], label: string, layer: unknown) {
    try {
      if (layer) {
        config.assertRuleArray(layer);
        rules.push(...layer);
      }
    } catch (e) {
      throw typeof e === "string" ? `${label}: ${e}` : e;
    }
  }

  private concatRuleLayers(wc: vscode.WorkspaceConfiguration): config.Rule[] {
    try {
      const r = wc.inspect<unknown>("rules");
      if (!r) return [];
      const rules: config.Rule[] = [];
      this.concatRuleLayer(rules, "defaultLanguageValue", r.defaultLanguageValue);
      this.concatRuleLayer(rules, "defaultValue", r.defaultValue);
      this.concatRuleLayer(rules, "globalLanguageValue", r.globalLanguageValue);
      this.concatRuleLayer(rules, "globalValue", r.globalValue);
      this.concatRuleLayer(rules, "workspaceFolderLanguageValue", r.workspaceFolderLanguageValue);
      this.concatRuleLayer(rules, "workspaceFolderValue", r.workspaceFolderValue);
      this.concatRuleLayer(rules, "workspaceLanguageValue", r.workspaceLanguageValue);
      this.concatRuleLayer(rules, "workspaceValue", r.workspaceValue);
      return rules;
    } catch (e) {
      throw typeof e === "string" ? `concat rule lists: ${e}` : e;
    }
  }

  read(scope: Scope): config.File {
    const wc = vscode.workspace.getConfiguration("dim", scope);
    try {
      return {
        defaultFlags: wc.get<string>("defaultFlags", "g"),
        defaultOpacityTier: wc.get<config.Opacity>("defaultOpacityTier", config.Opacity.Mid),
        rules: this.concatRuleLayers(wc),
        updatePeriod: wc.get<number>("updatePeriod", 500),
        valueForMaxTier: wc.get<number>("valueForMaxTier", 0.75),
        valueForMidTier: wc.get<number>("valueForMidTier", 0.5),
        valueForMinTier: wc.get<number>("valueForMinTier", 0.25),
      } satisfies config.File;
    } catch (e) {
      throw typeof e === "string" ? `read: ${e}` : e;
    }
  }
}

class Compiler {
  private reader: Reader;
  private logger: vscode.OutputChannel;

  constructor(l: vscode.OutputChannel) {
    this.reader = new Reader();
    this.logger = l;
  }

  private rules(raw: config.File): models.Rule[] {
    const rules: models.Rule[] = [];
    for (const rule of raw.rules) {
      if (typeof rule.pattern !== "string") continue;
      rules.push({
        regex: new RegExp(rule.pattern, rule.flags ?? raw.defaultFlags),
        opacity: rule.opacity ? config.toOpacity(rule.opacity) : raw.defaultOpacityTier,
      });
    }
    return rules;
  }

  compile(scope: Scope): models.Config {
    try {
      this.logger.appendLine(`config.Compiler: compiling user config for ${scope}`);
      const raw = this.reader.read(scope);
      const rules = this.rules(raw);
      return {
        rules: rules,
        updatePeriod: raw.updatePeriod,
        valueForMaxTier: raw.valueForMaxTier,
        valueForMidTier: raw.valueForMidTier,
        valueForMinTier: raw.valueForMinTier,
      } satisfies models.Config;
    } catch (e) {
      throw typeof e === "string" ? `compile for ${scope}: ${e}` : e;
    }
  }
}

export class Cache {
  private cache: Map<ScopeId, models.Config>;
  private compiler: Compiler;
  private logger: vscode.OutputChannel;

  constructor(l: vscode.OutputChannel) {
    this.cache = new Map();
    this.compiler = new Compiler(l);
    this.logger = l;
  }

  for(editor: vscode.TextEditor): models.Config {
    try {
      const scope = new Scope(editor);
      this.logger.appendLine(`config.Manager: requested user config for ${scope}`);
      const i = scope.internalize();
      let c = this.cache.get(i);
      if (!c) {
        c = this.compiler.compile(scope);
        this.cache.set(i, c);
      }
      return c;
    } catch (e) {
      throw typeof e === "string" ? `for: ${e}` : e;
    }
  }

  invalidate() {
    this.logger.appendLine("config.Manager: invalidating cache");
    this.cache.clear();
  }
}
