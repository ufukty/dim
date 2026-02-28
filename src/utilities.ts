import * as vscode from "vscode";

export function SprintPos(pos: vscode.Position): string {
  return `${pos.line + 1}:${pos.character + 1}`;
}

export function SprintRange(range: vscode.Range): string {
  return `[${SprintPos(range.start)}, ${SprintPos(range.end)}]`;
}
