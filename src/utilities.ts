import { start } from "repl";
import * as vscode from "vscode";

export function changeLineInRange(src: vscode.Range, line: number): vscode.Range {
    return new vscode.Range(
        new vscode.Position(line, src.start.character),
        new vscode.Position(line, src.end.character)
    );
}

export function getRemainingRangeInRange(
    whole: vscode.Range,
    scanned: vscode.Range,
    maxLinesBetween: number
): vscode.Range | undefined {
    if (whole.end.line - scanned.end.line <= 1) return undefined;
    if (maxLinesBetween === 0) return undefined;
    const start = scanned.end.line + 1;
    return new vscode.Range(
        new vscode.Position(start, scanned.end.character),
        new vscode.Position(Math.min(whole.end.line, start + maxLinesBetween), whole.end.character)
    );
}

export function connectTwoRanges(start: vscode.Range, end: vscode.Range): vscode.Range {
    return new vscode.Range(
        new vscode.Position(start.start.line, start.start.character),
        new vscode.Position(end.end.line, end.end.character)
    );
}

export function lineAt(editor: vscode.TextEditor, line: number): vscode.TextLine | undefined {
    try {
        return editor.document.lineAt(line);
    } catch (e: any) {
        return undefined;
    }
}

export function SprintPos(pos: vscode.Position): string {
    return `${pos.line + 1}:${pos.character + 1}`;
}

export function SprintRange(range: vscode.Range): string {
    return `[${SprintPos(range.start)}, ${SprintPos(range.end)}]`;
}
