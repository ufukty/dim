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

  _marshallRules(jsonRules: config.Rule[], defaultOpacity: config.Opacity, defaultFlags: string): models.Rule[] {
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

  _getWorkspaceRulesInJSON(workspaceConfig: vscode.WorkspaceConfiguration): config.Rule[] {
    const jsonRules = workspaceConfig.get("rules") ?? [];
    if (!Array.isArray(jsonRules)) return [];
    return jsonRules;
  }

  _getActiveDocumentLanguageSlug(editor: vscode.TextEditor) {
    return "[" + editor.document.uri.path.split(".").pop() + "]";
  }

  _getLanguageSpecificRulesInJSON(editor: vscode.TextEditor): config.Rule[] {
    const activeLangSlug = this._getActiveDocumentLanguageSlug(editor);

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

  _readRules(editor: vscode.TextEditor, workspaceConfig: vscode.WorkspaceConfiguration): models.Rule[] {
    const defaultOpacity = (workspaceConfig.get("defaultOpacityTier") as config.Opacity) ?? config.Opacity.Mid;
    const defaultFlags = (workspaceConfig.get("defaultFlags") as string) ?? "gs";
    const workspaceRules = this._getWorkspaceRulesInJSON(workspaceConfig);
    const languageSpecificRules = this._getLanguageSpecificRulesInJSON(editor);
    const rules = this._marshallRules([...workspaceRules, ...languageSpecificRules], defaultOpacity, defaultFlags);
    return rules;
  }

  readConfig(editor: vscode.TextEditor): models.Config {
    const cached = this._configCache.get(editor.document.uri);
    if (cached) {
      return cached;
    }
    const workspaceConfig = vscode.workspace.getConfiguration("dim", editor.document.uri);
    const config: models.Config = {
      rules: this._readRules(editor, workspaceConfig),
      valueForMinTier: workspaceConfig.get("valueForMinTier") ?? 0.25,
      valueForMidTier: workspaceConfig.get("valueForMidTier") ?? 0.5,
      valueForMaxTier: workspaceConfig.get("valueForMaxTier") ?? 0.75,
      updatePeriod: workspaceConfig.get("updatePeriod") ?? 500,
    };
    this._configCache.set(editor.document.uri, config);
    return config;
  }
}
