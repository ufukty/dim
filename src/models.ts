import * as vscode from "vscode";

export enum Opacity {
    Max = "max",
    Mid = "mid",
    Min = "min",
}

export interface MultilineRule {
    endRule: RegExp;
    startRule: RegExp;
    opacity: Opacity | undefined;
    maxLinesBetween: number;
    sameScope: boolean;
}

export interface OnelineRule {
    rule: RegExp;
    opacity: Opacity | undefined;
}

export type Rule = MultilineRule | OnelineRule;

export interface Config {
    rules: Rule[];
    valueForMaxTier: number;
    valueForMidTier: number;
    valueForMinTier: number;
    defaultScanLimit: number;
}

function marshallRules(jsonRules: any[], defaultOpacity: Opacity, defaultMaxLinesBetween: number): Rule[] {
    return jsonRules.map((rule) => {
        if ("rule" in rule) {
            return {
                rule: new RegExp(rule["rule"], "g"),
                opacity: rule["opacity"] ?? defaultOpacity,
            };
        } else {
            return {
                startRule: new RegExp(rule["start"], "g"),
                endRule: new RegExp(rule["end"], "g"),
                opacity: rule["opacity"] ?? defaultOpacity,
                maxLinesBetween: rule["maxLinesBetween"] ?? defaultMaxLinesBetween,
                sameScope: rule["ignoreMatchingBraces"],
            };
        }
    });
}

function getWorkspaceRulesInJSON(workspaceConfig: vscode.WorkspaceConfiguration): any[] {
    const jsonRules = workspaceConfig.get("rules") ?? [];
    if (!Array.isArray(jsonRules)) return [];
    return jsonRules;
}

function getActiveDocumentLanguageSlug(editor: vscode.TextEditor) {
    return "[" + editor.document.uri.path.split(".").pop() + "]";
}

function getLanguageSpecificRulesInJSON(editor: vscode.TextEditor): Rule[] {
    const activeLangSlug = getActiveDocumentLanguageSlug(editor);

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

function readRules(editor: vscode.TextEditor, workspaceConfig: vscode.WorkspaceConfiguration): Rule[] {
    const defaultOpacity = (workspaceConfig.get("defaultOpacityTier") as Opacity) ?? Opacity.Mid;
    const defaultMaxLinesBetween = (workspaceConfig.get("defaultMaxLinesBetween") as number) ?? 5;

    const workspaceRules = getWorkspaceRulesInJSON(workspaceConfig);
    const languageSpecificRules = getLanguageSpecificRulesInJSON(editor);
    const rules = marshallRules([...workspaceRules, ...languageSpecificRules], defaultOpacity, defaultMaxLinesBetween);
    return rules;
}

export function readConfig(editor: vscode.TextEditor): Config {
    const workspaceConfig = vscode.workspace.getConfiguration("dim", editor.document.uri);
    return {
        rules: readRules(editor, workspaceConfig),
        valueForMinTier: workspaceConfig.get("valueForMinTier") ?? 0.25,
        valueForMidTier: workspaceConfig.get("valueForMidTier") ?? 0.5,
        valueForMaxTier: workspaceConfig.get("valueForMaxTier") ?? 0.75,
        defaultScanLimit: workspaceConfig.get("defaultScanLimit") ?? 1000,
    };
}

export interface PerDecorationQueue {
    "max": vscode.Range[];
    "mid": vscode.Range[];
    "min": vscode.Range[];
}

export interface DecorationTypes {
    "max": vscode.TextEditorDecorationType;
    "mid": vscode.TextEditorDecorationType;
    "min": vscode.TextEditorDecorationType;
}

export interface RuleMatch {
    rule: Rule;
    range: vscode.Range;
    scopeLevelBefore: number;
}
