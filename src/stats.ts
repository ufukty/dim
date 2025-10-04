import * as vscode from "vscode";

class StoredCounter {
    context: vscode.ExtensionContext;
    key: string;

    constructor(context: vscode.ExtensionContext, key: string) {
        this.context = context;
        this.key = key;
    }

    Get(): number {
        return this.context.globalState.get<number>(this.key) ?? 0;
    }

    Set(value: number) {
        this.context.globalState.update(this.key, value);
    }

    Increment() {
        this.Set(this.Get() + 1);
    }
}

export class ConfigInteractionStatsManager {
    context: vscode.ExtensionContext;
    logger: vscode.OutputChannel;
    total: StoredCounter;

    constructor(logger: vscode.OutputChannel, context: vscode.ExtensionContext) {
        this.logger = logger;
        this.context = context;
        this.total = new StoredCounter(context, "stats.config.change.total");
    }

    atTotal(): number {
        return this.total.Get();
    }

    inCurrentSession(): number {
        return 0;
    }

    onDidChangeConfiguration() {
        this.total.Increment();
    }
}
