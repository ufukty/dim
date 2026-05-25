import * as vscode from "vscode";
import * as config from "./config";

export interface DecorationTypes {
  max: vscode.TextEditorDecorationType;
  mid: vscode.TextEditorDecorationType;
  min: vscode.TextEditorDecorationType;
}

/* Compiled version of {@link config.Rule}. */
export interface Rule {
  regex: RegExp;
  opacity: config.Opacity;
}

export interface Config {
  rules: Rule[];
  decoTypes: DecorationTypes;
  updatePeriod: number;
}
