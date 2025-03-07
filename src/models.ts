import * as vscode from "vscode";

export enum Opacity {
    Max = "max",
    Mid = "mid",
    Min = "min",
}

export interface Rule {
    rule: RegExp;
    opacity: Opacity;
}

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
