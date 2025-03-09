import * as vscode from "vscode";
import * as models from "./models";
import * as utils from "./utilities";
import { ConfigManager } from "./configmanager";

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

    constructor(
        editor: vscode.TextEditor,
        configManager: ConfigManager,
        enabled: boolean,
        logger: vscode.OutputChannel
    ) {
        this._editor = editor;
        this._configManager = configManager;
        this._logger = logger;
        this._enabled = enabled;

        const _filename = editor.document.fileName.split("/").pop();
        if (_filename) this._filename = _filename;
        else this._filename = "";

        this._lastUpdateTimestamp = 0;

        this._logger.appendLine(`${this._filename}: constructor (enabled: ${enabled})`);
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

    doBracesMatch(text: string, start: number, end: number): boolean {
        let balance = 0;
        for (let i = start; i < Math.min(text.length, end); i++) {
            if (text[i] === "{") balance++;
            if (text[i] === "}") balance--;
        }
        return balance === 0;
    }

    scanForRule(range: vscode.Range, rule: models.Rule): vscode.Range[] {
        this._logger.appendLine(`${this._filename}: scanning for: ${rule.regex}`);
        var ranges: vscode.Range[] = [];
        const text = this._editor.document.getText(range);
        Array.from(text.matchAll(rule.regex)).forEach((match) => {
            if (!match.index || !match[0]) return;
            const start = match.index;
            const end = start + match[0].length;
            const range = new vscode.Range(
                this._editor.document.positionAt(start),
                this._editor.document.positionAt(end)
            );
            if (this.doBracesMatch(text, start, end)) {
                this._logger.appendLine(
                    `${this._filename}: scanning for: ${rule.regex}: found: ${utils.SprintRange(range)}`
                );
                ranges.push(range);
            }
        });
        return ranges;
    }

    _disposeLastDecorations() {
        this._logger.appendLine(`${this._filename}: disposing previous decorations`);
        if (!this._decoTypes) return;
        this._decoTypes.max.dispose();
        this._decoTypes.mid.dispose();
        this._decoTypes.min.dispose();
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

    _mergeIntersecting(queue: vscode.Range[]): vscode.Range[] {
        if (queue.length <= 1) return queue;
        const sorted = queue.sort((a, b) => {
            // no overlap: aa-bb
            if (a.end.isBeforeOrEqual(b.start)) {
                return -1;
            }
            // no overlap: bb-aa
            if (b.end.isBeforeOrEqual(a.start)) {
                return 1;
            }
            // partial overlap: ab-ab
            if (a.start.isBeforeOrEqual(b.start)) {
                return -1;
            }
            // partial overlap: ba-ba
            if (b.start.isBeforeOrEqual(a.start)) {
                return 1;
            }
            return 0;
        });
        var merged = [] as vscode.Range[];
        var merging = sorted[0];
        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i].intersection(merging)) {
                var m = merging;
                const before = utils.SprintRange(m);
                m = sorted[i];
                const after = utils.SprintRange(m);
                merging = merging.with(sorted[i]);
                this._logger.appendLine(`${this._filename}: merging ${before} with ${after}`);
            } else {
                merged.push(merging);
                merging = sorted[i];
            }
        }
        merged.push(merging);
        return merged;
    }

    _applyNewDecorations(perDecoQueues: models.PerDecorationQueue) {
        const decoTypes = this._prepareDecorationTypes();
        this._editor.setDecorations(decoTypes.max, this._mergeIntersecting(perDecoQueues.max));
        this._editor.setDecorations(decoTypes.mid, this._mergeIntersecting(perDecoQueues.mid));
        this._editor.setDecorations(decoTypes.min, this._mergeIntersecting(perDecoQueues.min));
        this._decoTypes = decoTypes;
    }

    _decorateEditor() {
        this._logger.appendLine(this._filename + ": decorating...");
        const start = Date.now();

        var queues = {
            "max": [] as vscode.Range[],
            "mid": [] as vscode.Range[],
            "min": [] as vscode.Range[],
        };
        const range = this._editor.document.validateRange(
            new vscode.Range(new vscode.Position(0, 0), new vscode.Position(2000, 0))
        );
        this._logger.appendLine(`${this._filename}: scanning lines: ${utils.SprintRange(range)}`);
        for (const rule of this._config.rules) {
            for (const match of this.scanForRule(range, rule)) {
                queues[rule.opacity].push(match);
            }
        }

        this._disposeLastDecorations();
        this._applyNewDecorations(queues);

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
