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
