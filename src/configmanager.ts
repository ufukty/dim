import * as vscode from "vscode";
import { Config, Opacity, Rule } from "./models";

export class ConfigManager {
    _configCache: Map<vscode.ConfigurationScope, Config>;

    constructor() {
        this._configCache = new Map();
    }

    clearConfigCache(e: vscode.ConfigurationChangeEvent) {
        this._configCache.clear();
    }

    _marshallRules(jsonRules: any[], defaultOpacity: Opacity, defaultFlags: string): Rule[] {
        return jsonRules
            .filter((rule) => {
                return "pattern" in rule;
            })
            .map((rule) => {
                return {
                    regex: new RegExp(rule["pattern"], rule["flags"] ?? defaultFlags),
                    opacity: rule["opacity"] ?? defaultOpacity,
                };
            });
    }

    _getWorkspaceRulesInJSON(workspaceConfig: vscode.WorkspaceConfiguration): any[] {
        const jsonRules = workspaceConfig.get("rules") ?? [];
        if (!Array.isArray(jsonRules)) return [];
        return jsonRules;
    }

    _getActiveDocumentLanguageSlug(editor: vscode.TextEditor) {
        return "[" + editor.document.uri.path.split(".").pop() + "]";
    }

    _getLanguageSpecificRulesInJSON(editor: vscode.TextEditor): Rule[] {
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

    _readRules(editor: vscode.TextEditor, workspaceConfig: vscode.WorkspaceConfiguration): Rule[] {
        const defaultOpacity = (workspaceConfig.get("defaultOpacityTier") as Opacity) ?? Opacity.Mid;
        const defaultFlags = (workspaceConfig.get("defaultFlags") as string) ?? "gs";
        const workspaceRules = this._getWorkspaceRulesInJSON(workspaceConfig);
        const languageSpecificRules = this._getLanguageSpecificRulesInJSON(editor);
        const rules = this._marshallRules([...workspaceRules, ...languageSpecificRules], defaultOpacity, defaultFlags);
        return rules;
    }

    readConfig(editor: vscode.TextEditor): Config {
        var cached = this._configCache.get(editor.document.uri);
        if (cached) {
            return cached;
        }
        const workspaceConfig = vscode.workspace.getConfiguration("dim", editor.document.uri);
        var config: Config = {
            rules: this._readRules(editor, workspaceConfig),
            valueForMinTier: workspaceConfig.get("valueForMinTier") ?? 0.25,
            valueForMidTier: workspaceConfig.get("valueForMidTier") ?? 0.5,
            valueForMaxTier: workspaceConfig.get("valueForMaxTier") ?? 0.75,
            defaultScanLimit: workspaceConfig.get("defaultScanLimit") ?? 1000,
        };
        this._configCache.set(editor.document.uri, config);
        return config;
    }
}
