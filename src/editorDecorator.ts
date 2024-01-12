import * as vscode from "vscode";
import * as models from "./models";
import * as utilities from "./utilities";

export class EditorDecorator {
    _editor: vscode.TextEditor;
    _filename: string;
    _logger: vscode.OutputChannel;
    _decorationTypeMapping: WeakMap<vscode.TextEditor, models.DecorationTypes>;

    // _lastUpdateTimestamp: number;

    // _scheduleUpdateForEditor: vscode.TextEditor | undefined;
    // _lastUpdatedEditor: vscode.TextEditor | undefined;
    // _timeoutForScheduler: NodeJS.Timeout | undefined;
    // _activeEditor: vscode.TextEditor | undefined;

    constructor(editor: vscode.TextEditor, logger: vscode.OutputChannel) {
        this._editor = editor;
        this._logger = logger;
        this._decorationTypeMapping = new WeakMap<vscode.TextEditor, models.DecorationTypes>();

        // this._editorInUpdate = undefined;
        // this._scheduleUpdateForEditor = undefined;
        // this._lastUpdatedEditor = undefined;
        // this._lastUpdateTimestamp = Date.now() - 1000 * 1000;
        // this._activeEditor = undefined;

        const filename = editor.document.fileName.split("/").pop();
        if (filename) this._filename = filename;
        else this._filename = "";
    }

    _getScanRange(config: models.Config): vscode.Range {
        const limitRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(config.defaultScanLimit, 0));
        const documentRange = new vscode.Range(
            new vscode.Position(0, 0),
            new vscode.Position(
                this._editor.document.lineCount - 1,
                this._editor.document.lineAt(
                    new vscode.Position(this._editor.document.lineCount - 1, 0)
                ).range.end.character
            )
        );
        return documentRange.intersection(limitRange) ?? documentRange;
    }

    _getMatchInLine(lineContentInRange: string, regexp: RegExp): vscode.Range | undefined {
        const matches = [...lineContentInRange.matchAll(regexp)];
        if (matches.length === 0) return undefined;
        const match = matches[0];
        if (match.index === undefined || match.length === undefined) return undefined;
        const start = new vscode.Position(0, match.index);
        const end = new vscode.Position(0, match.index + match[0].length);
        return new vscode.Range(start, end);
    }

    _scanRangeForSinglelineRule(range: vscode.Range, regex: RegExp): vscode.Range | undefined {
        const firstLine = range.start.line;
        const lastLine = range.end.line;
        for (let line = firstLine; line <= lastLine; line++) {
            var lineContent = utilities.lineAt(this._editor, line);
            if (lineContent === undefined) continue;

            var lineContentInRange = lineContent.text;
            if (line === firstLine) lineContentInRange = lineContentInRange.substring(range.start.character);
            if (line === lastLine) lineContentInRange = lineContentInRange.substring(0, range.end.character);

            const foundPos = this._getMatchInLine(lineContentInRange, regex);
            if (foundPos) return utilities.changeLineInRange(foundPos, line);
        }
        return undefined;
    }

    /**
     * first return value is the character index that is visited before exit main scope
     * second return value is the last scopeLevel
     */
    _checkScopeElevation(lineContent: string, scopeLevel: number): [number | undefined, number] {
        // 1st capture group is in:  { [ (
        // 2nd capture group is out: } ] )
        const scopeChangePattern = /([\(|\[|\{]{1})|([\}|\]|\)]{1})/g;
        const scopeChanges = [...lineContent.matchAll(scopeChangePattern)];
        for (const scopeChange of scopeChanges) {
            if (1 in scopeChange && scopeChange[1] !== undefined) scopeLevel++;
            else if (2 in scopeChange && scopeChange[2] !== undefined) scopeLevel--;
            if (scopeLevel < 0) return [scopeChange.index, scopeLevel];
        }
        return [undefined, scopeLevel];
    }

    _restrictRangeToScope(range: vscode.Range, startMatch: vscode.Range): vscode.Range | undefined {
        const startLine = utilities.lineAt(this._editor, startMatch.end.line);
        if (startLine === undefined) return undefined;
        const startLineClipped = startLine.text.substring(startMatch.end.character);
        var [scopeEndChar, scopeElevation] = this._checkScopeElevation(startLineClipped, 0);
        if (scopeEndChar !== undefined) return new vscode.Range(startMatch.end, new vscode.Position(0, scopeEndChar));

        var totalScopeElevation = scopeElevation;
        for (var line = range.start.line + 1; line < range.end.line; line++) {
            const lineContent = utilities.lineAt(this._editor, line);
            if (lineContent === undefined) return range;
            [scopeEndChar, scopeElevation] = this._checkScopeElevation(lineContent.text, totalScopeElevation);
            if (scopeEndChar !== undefined)
                return new vscode.Range(startMatch.end, new vscode.Position(line, scopeEndChar));
            totalScopeElevation = scopeElevation;
        }

        return range;
    }

    _restrictRange(range: vscode.Range, maxLinesBetween: number, startMatch: vscode.Range): vscode.Range {
        var restrictedRangeWithLinesBetween = utilities.getRemainingRangeInRange(range, startMatch, maxLinesBetween);
        if (restrictedRangeWithLinesBetween === undefined) return range;

        const restrictedRangeWithScope = this._restrictRangeToScope(restrictedRangeWithLinesBetween, startMatch);
        if (restrictedRangeWithScope === undefined) return restrictedRangeWithLinesBetween;

        return restrictedRangeWithScope;
    }

    _scanRangeForMultilineRule(range: vscode.Range, rule: models.MultilineRule): vscode.Range | undefined {
        const startMatch = this._scanRangeForSinglelineRule(range, rule["startRule"]);
        if (startMatch === undefined) return undefined;
        var restrictedRange = this._restrictRange(range, rule.maxLinesBetween, startMatch);
        const endMatch = this._scanRangeForSinglelineRule(restrictedRange, rule["endRule"]);
        if (endMatch === undefined) return undefined;
        return utilities.connectTwoRanges(startMatch, endMatch);
    }

    _scanRangeForRule(range: vscode.Range, rule: models.Rule): vscode.Range[] {
        var matches: vscode.Range[] = [];
        var match: vscode.Range | undefined;
        while (true) {
            match = undefined;
            if ("rule" in rule) {
                match = this._scanRangeForSinglelineRule(range, rule["rule"]);
            } else if ("startRule" in rule && "endRule" in rule) {
                match = this._scanRangeForMultilineRule(range, rule);
            }
            if (match === undefined) return matches;
            else {
                matches.push(match);
                range = new vscode.Range(match.end, range.end);
            }
        }
    }

    _prepareDecorationTypes(config: models.Config): models.DecorationTypes {
        return {
            "max": vscode.window.createTextEditorDecorationType({
                "opacity": config.valueForMaxTier.toString(),
                "isWholeLine": false,
            }),
            "mid": vscode.window.createTextEditorDecorationType({
                "opacity": config.valueForMidTier.toString(),
                "isWholeLine": false,
            }),
            "min": vscode.window.createTextEditorDecorationType({
                "opacity": config.valueForMinTier.toString(),
                "isWholeLine": false,
            }),
        };
    }

    _getPerDecorationTypeQueue(): models.PerDecorationQueue {
        return {
            "max": [] as vscode.Range[],
            "mid": [] as vscode.Range[],
            "min": [] as vscode.Range[],
        };
    }

    _saveMatchToQueue(queues: models.PerDecorationQueue, match: vscode.Range, rule: models.Rule) {
        switch (rule.opacity) {
            case models.Opacity.Max:
                queues.max.push(match);
                break;
            case models.Opacity.Mid:
                queues.mid.push(match);
                break;
            case models.Opacity.Min:
                queues.min.push(match);
                break;
        }
    }

    disposeLastDecorations() {
        const decoTypes = this._decorationTypeMapping.get(this._editor);
        if (decoTypes === undefined) return;
        decoTypes.max.dispose();
        decoTypes.mid.dispose();
        decoTypes.min.dispose();
    }

    _applyNewDecorations(config: models.Config, perDecoQueues: models.PerDecorationQueue) {
        const decoTypes = this._prepareDecorationTypes(config);
        this._editor.setDecorations(decoTypes.max, perDecoQueues.max);
        this._editor.setDecorations(decoTypes.mid, perDecoQueues.mid);
        this._editor.setDecorations(decoTypes.min, perDecoQueues.min);
        this._decorationTypeMapping.set(this._editor, decoTypes);
    }

    _decorateEditor() {
        if (this._editor.document.uri.scheme !== "file") return;
        this._logger.appendLine(this._filename + ": decorating...");

        const config = models.readConfig(this._editor);
        if (config === undefined || config.rules === undefined) return;

        const range = this._getScanRange(config);
        const perDecoQueues = this._getPerDecorationTypeQueue();
        for (const rule of config.rules) {
            const matches = this._scanRangeForRule(range, rule);
            for (const match of matches) this._saveMatchToQueue(perDecoQueues, match, rule);
        }

        this.disposeLastDecorations();
        this._applyNewDecorations(config, perDecoQueues);

        this._logger.appendLine(this._filename + ": done");
    }

    // schedule(this._editor: vscode.TextEditor) {
    //     if (this._editor === undefined) return;
    //     this._activeEditor = editor;

    //     const period = 2000;
    //     var isPeriodCompleted = Date.now() - this._lastUpdateTimestamp > period;
    //     var isFirstRun = this._lastUpdatedEditor === undefined && this._editorInUpdate === undefined;
    //     var isTabSwitch = this._lastUpdatedEditor !== editor;

    //     var isSchedulingOutdated =
    //         this._scheduleUpdateForEditor !== undefined && this._scheduleUpdateForEditor !== editor;
    //     var periodCompletedInSameEditor = this._lastUpdatedEditor === editor && isPeriodCompleted;

    //     var hasEditorSwitched = this._editorInUpdate !== editor || this._lastUpdatedEditor !== editor;
    //     var isSchedulingNotNecessary = hasEditorSwitched || Date.now() - this._lastUpdateTimestamp > period;

    //     var isResetNecessary = isFirstRun || isTabSwitch
    //     var isUpdateNecessary =  || hasEditorSwitched;
    //     var isProcessNecessary = isUpdateNecessary || isResetNecessary

    //     console.log(hasEditorSwitched, isSchedulingNotNecessary);
    //     if (isUpdateNecessary) {
    //         if (isSchedulingNotNecessary) {
    //             this._editorInUpdate = editor;
    //             this._decorateEditor(this._editor);
    //             this._lastUpdateTimestamp = Date.now();
    //             this._editorInUpdate = undefined;
    //             this._lastUpdatedEditor = editor;
    //         } else {
    //             if (this._timeoutForScheduler !== undefined) {
    //                 clearTimeout(this._timeoutForScheduler);
    //                 this._timeoutForScheduler = undefined;
    //             }
    //             this._scheduleUpdateForEditor = editor;
    //             const waitTime = period - (Date.now() - this._lastUpdateTimestamp);
    //             this._timeoutForScheduler = setTimeout(() => {
    //                 if (this._editor === this._activeEditor) {
    //                     this.schedule(this._editor);
    //                 }
    //             }, waitTime);
    //         }
    //     }
    // }

    blur() {
        this._logger.appendLine(this._editor.document.fileName.split("/").pop() + ": blur");
    }

    focus() {
        this._logger.appendLine(this._editor.document.fileName.split("/").pop() + ": focus");
    }

    contentChange(event: vscode.TextDocumentChangeEvent) {
        this._logger.appendLine(this._editor.document.fileName.split("/").pop() + ": contentChange");
        printTextDocumentChangeEvent(this._logger, event);
        this._unionRanges(event);
    }

    _unionRanges(event: vscode.TextDocumentChangeEvent) {
        var queuedDeletions: boolean = false;
        var queuedAdditions: boolean = false;

        event.contentChanges.forEach((v) => {
            const isDeletion = !v.range.isEmpty;
            const isAddition = v.text.length > 0;
            const isReplacement = isDeletion && isAddition;

            // adjust the line numbers of ranges previously added to 'changed' that comes after deleted part

            if (isReplacement) {
                queuedDeletions = true;
                // queuedDeletions.push(v.range);
                queuedAdditions = true;
                // queuedAdditions.push(v.range);
                // queuedAdditions.push(new vscode.Range(start: v.range.start: end: vscode.position));
            } else if (isDeletion) {
                queuedDeletions = true;
                // queuedDeletions.push(v.range);
            } else if (isAddition) {
                queuedAdditions = true;
                // queuedAdditions.push(v.range);
            }
            // for (const r1 of ranges) {
            //     if (v.range.start.line < r1.start.line) min = v.range.start.line;
            //     if (v.range.end.line < max) max = v.range.end.line;
            // }
        });

        if (queuedAdditions || queuedDeletions) this._decorateEditor();
        else this._logger.appendLine(this._filename + ": empty content change");
    }
}

function printTextDocumentChangeEvent(logger: vscode.OutputChannel, event: vscode.TextDocumentChangeEvent) {
    if (event.reason) logger.appendLine(event.reason.toString());
    event.contentChanges.forEach((v) => {
        logger.appendLine(
            "[" +
                v.range.start.line +
                ", " +
                v.range.start.character +
                "] => [" +
                v.range.end.line +
                ", " +
                v.range.end.character +
                "] replaced length = " +
                v.rangeLength +
                " (->" +
                v.rangeOffset +
                "), text = '" +
                v.text +
                "'"
        );
    });
}

// export class Range {
//     start: number;
//     end: number;
//     constructor(start: number, end: number) {
//         this.start = start;
//         this.end = end;
//     }
//     union(neighbor: Range): boolean {}
// }
