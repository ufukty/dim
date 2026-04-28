import * as vscode from "vscode";
import * as config from "./config";
import * as models from "./models";

function getScope(editor: vscode.TextEditor): vscode.ConfigurationScope {
  return {
    uri: editor.document.uri,
    languageId: editor.document.languageId,
  };
}

type ScopeId = string;

function internalize(editor: vscode.TextEditor): ScopeId {
  return `${editor.document.uri.toString()}\u0000${editor.document.languageId}`;
}

class ConfigCompiler {
  private read(scope: vscode.ConfigurationScope): config.File {
    const wc = vscode.workspace.getConfiguration("dim", scope);
    return {
      defaultFlags: wc.get<string>("defaultFlags", "g"),
      defaultOpacityTier: wc.get<config.Opacity>("defaultOpacityTier", config.Opacity.Mid),
      rules: wc.get<config.Rule[]>("rules", []),
      updatePeriod: wc.get<number>("updatePeriod", 500),
      valueForMaxTier: wc.get<number>("valueForMaxTier", 0.75),
      valueForMidTier: wc.get<number>("valueForMidTier", 0.5),
      valueForMinTier: wc.get<number>("valueForMinTier", 0.25),
    } satisfies config.File;
  }

  private compileRules(raw: config.File): models.Rule[] {
    const rules: models.Rule[] = [];
    for (const rule of raw.rules) {
      if (typeof rule.pattern !== "string") continue;
      rules.push({
        regex: new RegExp(rule.pattern, rule.flags ?? raw.defaultFlags),
        opacity: config.isOpacity(rule.opacity) ? rule.opacity : raw.defaultOpacityTier,
      });
    }
    return rules;
  }

  compile(scope: vscode.ConfigurationScope): models.Config {
    const raw = this.read(scope);
    const rules = this.compileRules(raw);
    return {
      rules: rules,
      updatePeriod: raw.updatePeriod,
      valueForMaxTier: raw.valueForMaxTier,
      valueForMidTier: raw.valueForMidTier,
      valueForMinTier: raw.valueForMinTier,
    } satisfies models.Config;
  }
}

export class ConfigManager {
  private cache: Map<ScopeId, models.Config>;
  private compiler: ConfigCompiler;

  constructor() {
    this.cache = new Map();
    this.compiler = new ConfigCompiler();
  }

  for(editor: vscode.TextEditor): models.Config {
    const i = internalize(editor);
    let c = this.cache.get(i);
    if (!c) {
      c = this.compiler.compile(getScope(editor));
      this.cache.set(i, c);
    }
    return c;
  }

  invalidate() {
    this.cache.clear();
  }
}
