import * as vscode from "vscode";

export function now(): string {
  return new Date().toISOString();
}

export function filename(uri: vscode.Uri): string {
  return uri.path.split("/").pop() ?? "";
}
