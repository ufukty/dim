import * as vscode from "vscode";
import * as config from "./config";

export interface DecorationTypes {
  max: vscode.TextEditorDecorationType;
  mid: vscode.TextEditorDecorationType;
  min: vscode.TextEditorDecorationType;
}

export interface Rule {
  regex: RegExp;
  opacity: config.Opacity;
  max: number;
}

export interface Config {
  rules: Rule[];
  decoTypes: DecorationTypes;
  updatePeriod: number;
}
