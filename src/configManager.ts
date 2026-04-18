import * as vscode from "vscode";
import * as config from "./config";
import * as models from "./models";

export class ConfigManager {
  _configCache: Map<vscode.ConfigurationScope, models.Config>;

  constructor() {
    this._configCache = new Map();
  }

  clearConfigCache() {
    this._configCache.clear();
  }

  private marshallRules(jsonRules: config.Rule[], defaultOpacity: config.Opacity, defaultFlags: string): models.Rule[] {
    return jsonRules
      .filter((rule) => {
        return "pattern" in rule;
      })
      .map((rule) => {
        return <models.Rule>{
          regex: new RegExp(rule["pattern"], rule["flags"] ?? defaultFlags),
          opacity: rule["opacity"] ?? defaultOpacity,
        };
      });
  }

  private getWorkspaceRulesInJSON(workspaceConfig: vscode.WorkspaceConfiguration): config.Rule[] {
    const jsonRules = workspaceConfig.get("rules") ?? [];
    if (!Array.isArray(jsonRules)) return [];
    return jsonRules;
  }

  private getActiveDocumentLanguageSlug(editor: vscode.TextEditor) {
    return "[" + editor.document.uri.path.split(".").pop() + "]";
  }

  private getLanguageSpecificRulesInJSON(editor: vscode.TextEditor): config.Rule[] {
    const activeLangSlug = this.getActiveDocumentLanguageSlug(editor);

    const workspaceConfig = vscode.workspace.getConfiguration();
    const langConfig = workspaceConfig.get(activeLangSlug);

    if (langConfig === undefined || langConfig === null || typeof langConfig !== "object") return [];

    if (!("dim.rules" in langConfig)) {
      return [];
    }

    const rules = langConfig["dim.rules"];
    if (!Array.isArray(rules)) {
      return [];
    }

    return rules;
  }

  private readRules(editor: vscode.TextEditor, workspaceConfig: vscode.WorkspaceConfiguration): models.Rule[] {
    const defaultOpacity = (workspaceConfig.get("defaultOpacityTier") as config.Opacity) ?? config.Opacity.Mid;
    const defaultFlags = (workspaceConfig.get("defaultFlags") as string) ?? "gs";
    const workspaceRules = this.getWorkspaceRulesInJSON(workspaceConfig);
    const languageSpecificRules = this.getLanguageSpecificRulesInJSON(editor);
    const rules = this.marshallRules([...workspaceRules, ...languageSpecificRules], defaultOpacity, defaultFlags);
    return rules;
  }

  readConfig(editor: vscode.TextEditor): models.Config {
    const cached = this._configCache.get(editor.document.uri);
    if (cached) {
      return cached;
    }
    const workspaceConfig = vscode.workspace.getConfiguration("dim", editor.document.uri);
    const config: models.Config = {
      rules: this.readRules(editor, workspaceConfig),
      valueForMinTier: workspaceConfig.get("valueForMinTier") ?? 0.25,
      valueForMidTier: workspaceConfig.get("valueForMidTier") ?? 0.5,
      valueForMaxTier: workspaceConfig.get("valueForMaxTier") ?? 0.75,
      updatePeriod: workspaceConfig.get("updatePeriod") ?? 500,
    };
    this._configCache.set(editor.document.uri, config);
    return config;
  }
}
