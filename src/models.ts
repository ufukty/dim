import * as vscode from "vscode";

export enum Opacity {
    Max = "max",
    Mid = "mid",
    Min = "min",
}

export interface Rule {
    regex: RegExp;
    opacity: Opacity;
}

export interface Config {
    rules: Rule[];
    valueForMaxTier: number;
    valueForMidTier: number;
    valueForMinTier: number;
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
