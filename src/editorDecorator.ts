import * as vscode from "vscode";
import * as models from "./models";
import * as utilities from "./utilities";
import { ConfigManager } from "./configmanager";

function logrule(logger: vscode.OutputChannel, filename: string, rule: models.Rule) {
    if ("rule" in rule) {
        logger.appendLine(`${filename}: applying one line rule: ${String((rule as models.OnelineRule).rule)}`);
    } else if ("start" in rule) {
        const start = String((rule as models.MultilineRule).start);
        const end = String((rule as models.MultilineRule).end);
        logger.appendLine(`${filename}: applying multi line rule: from ${start} to ${end}`);
    }
}

export class EditorDecorator {
    _editor: vscode.TextEditor;
    _config: models.Config;
    _configManager: ConfigManager;
    _filename: string;
    _logger: vscode.OutputChannel;
    _decoTypes: models.DecorationTypes | undefined;
    _enabled: boolean;

    _lastUpdateTimestamp: number;
    _timeoutForScheduler: NodeJS.Timeout | undefined;

    constructor(editor: vscode.TextEditor, configManager: ConfigManager, logger: vscode.OutputChannel) {
        this._editor = editor;
        this._configManager = configManager;
        this._logger = logger;
        this._enabled = true;

        const _filename = editor.document.fileName.split("/").pop();
        if (_filename) this._filename = _filename;
        else this._filename = "";

        this._lastUpdateTimestamp = 0;

        this._logger.appendLine(this._filename + ": constructor");
        this._config = this._configManager.readConfig(this._editor);
    }

    _schedule() {
        if (!this._enabled) {
            this._logger.appendLine(this._filename + ": skipping update because Dim is disabled for this editor");
            return;
        }
        const period = 500;
        var isSchedulingNecessary = Date.now() - this._lastUpdateTimestamp < period;

        if (!isSchedulingNecessary) {
            this._decorateEditor();
            this._lastUpdateTimestamp = Date.now();
        } else if (this._timeoutForScheduler === undefined) {
            const waitTime = period - (Date.now() - this._lastUpdateTimestamp);
            this._timeoutForScheduler = setTimeout(() => {
                this._schedule();
                this._timeoutForScheduler = undefined;
            }, waitTime);
        }
    }

    _getScanRange(): vscode.Range {
        const limitRange = new vscode.Range(
            new vscode.Position(0, 0),
            new vscode.Position(this._config.defaultScanLimit, 0)
        );
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
        const startMatch = this._scanRangeForSinglelineRule(range, rule["start"]);
        if (startMatch === undefined) return undefined;
        var restrictedRange = this._restrictRange(range, rule.maxLinesBetween, startMatch);
        const endMatch = this._scanRangeForSinglelineRule(restrictedRange, rule["end"]);
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
            } else if ("start" in rule && "end" in rule) {
                match = this._scanRangeForMultilineRule(range, rule);
            }
            if (match === undefined) return matches;
            else {
                matches.push(match);
                range = new vscode.Range(match.end, range.end);
            }
        }
    }

    _prepareDecorationTypes(): models.DecorationTypes {
        return {
            "max": vscode.window.createTextEditorDecorationType({
                "opacity": this._config.valueForMaxTier.toString(),
                "isWholeLine": false,
            }),
            "mid": vscode.window.createTextEditorDecorationType({
                "opacity": this._config.valueForMidTier.toString(),
                "isWholeLine": false,
            }),
            "min": vscode.window.createTextEditorDecorationType({
                "opacity": this._config.valueForMinTier.toString(),
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

    _disposeLastDecorations() {
        this._logger.appendLine(`${this._filename}: disposing previous decorations`);
        if (this._decoTypes === undefined) return;
        this._decoTypes.max.dispose();
        this._decoTypes.mid.dispose();
        this._decoTypes.min.dispose();
    }

    _applyNewDecorations(perDecoQueues: models.PerDecorationQueue) {
        const decoTypes = this._prepareDecorationTypes();
        this._editor.setDecorations(decoTypes.max, perDecoQueues.max);
        this._editor.setDecorations(decoTypes.mid, perDecoQueues.mid);
        this._editor.setDecorations(decoTypes.min, perDecoQueues.min);
        this._decoTypes = decoTypes;
    }

    _decorateEditor() {
        this._logger.appendLine(this._filename + ": decorating...");
        const start = Date.now();

        const range = this._getScanRange();
        const perDecoQueues = this._getPerDecorationTypeQueue();
        for (const rule of this._config.rules) {
            logrule(this._logger, this._filename, rule);
            const matches = this._scanRangeForRule(range, rule);
            for (const match of matches) this._saveMatchToQueue(perDecoQueues, match, rule);
        }

        this._disposeLastDecorations();
        this._applyNewDecorations(perDecoQueues);

        this._logger.appendLine(this._filename + ": decorated (" + (Date.now() - start) + "ms)");
    }

    blur() {
        this._logger.appendLine(this._filename + ": blur");
    }

    focus() {
        this._logger.appendLine(this._filename + ": focus");
        this._schedule();
    }

    contentChange() {
        this._logger.appendLine(this._filename + ": content change");
        this._schedule();
    }

    onDidChangeConfiguration() {
        this._logger.appendLine(this._filename + ": configuration change");
        this._config = this._configManager.readConfig(this._editor);
        this._schedule();
    }

    enable() {
        this._logger.appendLine(this._filename + ": enabling...");
        this._enabled = true;
        this._schedule();
    }

    disable() {
        this._logger.appendLine(this._filename + ": disabling...");
        this._enabled = false;
        this._disposeLastDecorations();
    }

    toggle() {
        if (this._enabled) this.disable();
        else this.enable();
    }
}
