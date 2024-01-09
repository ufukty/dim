import * as vscode from "vscode";
import * as models from "./models";
import * as utilities from "./utilities";

export class EditorDecorator {
    _editor: vscode.TextEditor;
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
    }

    _getScanRange(editor: vscode.TextEditor, config: models.Config): vscode.Range {
        const limitRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(config.defaultScanLimit, 0));
        const documentRange = new vscode.Range(
            new vscode.Position(0, 0),
            new vscode.Position(
                editor.document.lineCount - 1,
                editor.document.lineAt(new vscode.Position(editor.document.lineCount - 1, 0)).range.end.character
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

    _scanRangeForSinglelineRule(
        editor: vscode.TextEditor,
        range: vscode.Range,
        regex: RegExp
    ): vscode.Range | undefined {
        const firstLine = range.start.line;
        const lastLine = range.end.line;
        for (let line = firstLine; line <= lastLine; line++) {
            var lineContent = utilities.lineAt(editor, line);
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

    _restrictRangeToScope(
        editor: vscode.TextEditor,
        range: vscode.Range,
        startMatch: vscode.Range
    ): vscode.Range | undefined {
        const startLine = utilities.lineAt(editor, startMatch.end.line);
        if (startLine === undefined) return undefined;
        const startLineClipped = startLine.text.substring(startMatch.end.character);
        var [scopeEndChar, scopeElevation] = this._checkScopeElevation(startLineClipped, 0);
        if (scopeEndChar !== undefined) return new vscode.Range(startMatch.end, new vscode.Position(0, scopeEndChar));

        var totalScopeElevation = scopeElevation;
        for (var line = range.start.line + 1; line < range.end.line; line++) {
            const lineContent = utilities.lineAt(editor, line);
            if (lineContent === undefined) return range;
            [scopeEndChar, scopeElevation] = this._checkScopeElevation(lineContent.text, totalScopeElevation);
            if (scopeEndChar !== undefined)
                return new vscode.Range(startMatch.end, new vscode.Position(line, scopeEndChar));
            totalScopeElevation = scopeElevation;
        }

        return range;
    }

    _restrictRange(
        editor: vscode.TextEditor,
        range: vscode.Range,
        maxLinesBetween: number,
        startMatch: vscode.Range
    ): vscode.Range {
        var restrictedRangeWithLinesBetween = utilities.getRemainingRangeInRange(range, startMatch, maxLinesBetween);
        if (restrictedRangeWithLinesBetween === undefined) return range;

        const restrictedRangeWithScope = this._restrictRangeToScope(
            editor,
            restrictedRangeWithLinesBetween,
            startMatch
        );
        if (restrictedRangeWithScope === undefined) return restrictedRangeWithLinesBetween;

        return restrictedRangeWithScope;
    }

    _scanRangeForMultilineRule(
        editor: vscode.TextEditor,
        range: vscode.Range,
        rule: models.MultilineRule
    ): vscode.Range | undefined {
        const startMatch = this._scanRangeForSinglelineRule(editor, range, rule["startRule"]);
        if (startMatch === undefined) return undefined;
        var restrictedRange = this._restrictRange(editor, range, rule.maxLinesBetween, startMatch);
        const endMatch = this._scanRangeForSinglelineRule(editor, restrictedRange, rule["endRule"]);
        if (endMatch === undefined) return undefined;
        return utilities.connectTwoRanges(startMatch, endMatch);
    }

    _scanRangeForRule(editor: vscode.TextEditor, range: vscode.Range, rule: models.Rule): vscode.Range[] {
        var matches: vscode.Range[] = [];
        var match: vscode.Range | undefined;
        while (true) {
            match = undefined;
            if ("rule" in rule) {
                match = this._scanRangeForSinglelineRule(editor, range, rule["rule"]);
            } else if ("startRule" in rule && "endRule" in rule) {
                match = this._scanRangeForMultilineRule(editor, range, rule);
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

    disposeLastDecorations(editor: vscode.TextEditor) {
        const decoTypes = this._decorationTypeMapping.get(editor);
        if (decoTypes === undefined) return;
        decoTypes.max.dispose();
        decoTypes.mid.dispose();
        decoTypes.min.dispose();
    }

    _applyNewDecorations(editor: vscode.TextEditor, config: models.Config, perDecoQueues: models.PerDecorationQueue) {
        const decoTypes = this._prepareDecorationTypes(config);
        editor.setDecorations(decoTypes.max, perDecoQueues.max);
        editor.setDecorations(decoTypes.mid, perDecoQueues.mid);
        editor.setDecorations(decoTypes.min, perDecoQueues.min);
        this._decorationTypeMapping.set(editor, decoTypes);
    }

    _decorateEditor(editor: vscode.TextEditor) {
        if (editor.document.uri.scheme !== "file") return;
        this._logger.appendLine("decorating: " + editor.document.uri.path);

        const config = models.readConfig(editor);
        if (config === undefined || config.rules === undefined) return;

        const range = this._getScanRange(editor, config);
        console.log(range);
        const perDecoQueues = this._getPerDecorationTypeQueue();
        for (const rule of config.rules) {
            const matches = this._scanRangeForRule(editor, range, rule);
            for (const match of matches) this._saveMatchToQueue(perDecoQueues, match, rule);
        }

        this.disposeLastDecorations(editor);
        this._applyNewDecorations(editor, config, perDecoQueues);

        this._logger.appendLine("Done.");
    }

    // schedule(editor: vscode.TextEditor) {
    //     if (editor === undefined) return;
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
    //             this._decorateEditor(editor);
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
    //                 if (editor === this._activeEditor) {
    //                     this.schedule(editor);
    //                 }
    //             }, waitTime);
    //         }
    //     }
    // }

    blur() {
        this._logger.appendLine(this._editor.document.fileName.split("/").pop() + " lostFocus");
    }

    focus() {
        this._logger.appendLine(this._editor.document.fileName.split("/").pop() + " gotFocus");
    }

    contentChange() {
        this._logger.appendLine(this._editor.document.fileName.split("/").pop() + " contentChange");
    }
}
