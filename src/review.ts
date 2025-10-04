import * as vscode from "vscode";

const DayInMs = 24 * 60 * 60 * 1000;

function daysSince(timestamp: number): number {
    return (Date.now() - timestamp) / DayInMs;
}

const KeyUseCount = "review.useCount";
const KeyFirstSeen = "review.firstSeenAt";
const KeyLastPrompt = "review.lastPromptAt";
const KeyDoNotAskAgain = "review.dismissed";

const MinUses = 10;
const MinDaysSinceInstall = 7;
const CooldownDays = 60;

export class UponConfigEngagementReviewController {
    context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    updateCounters() {
        const uses = (this.context.globalState.get<number>(KeyUseCount) ?? 0) + 1;
        this.context.globalState.update(KeyUseCount, uses);

        if (!this.context.globalState.get<number>(KeyFirstSeen)) {
            this.context.globalState.update(KeyFirstSeen, Date.now());
        }
    }

    isTimeToPrompt(ctx: vscode.ExtensionContext): boolean {
        const dismissed = ctx.globalState.get<boolean>(KeyDoNotAskAgain) ?? false;
        if (dismissed) return false;

        const uses = ctx.globalState.get<number>(KeyUseCount) ?? 0;
        const firstSeen = ctx.globalState.get<number>(KeyFirstSeen) ?? Date.now();
        const lastPrompt = ctx.globalState.get<number>(KeyLastPrompt) ?? 0;

        if (uses < MinUses) return false;
        if (daysSince(firstSeen) < MinDaysSinceInstall) return false;
        if (lastPrompt && daysSince(lastPrompt) < CooldownDays) return false;

        return true;
    }

    async presentPrompt() {
        const PromptContent = "Enjoying Dim? A quick review helps more devs to focus on happy path.";
        const OptionWriteAReview = "Write a review";
        const OptionMaybeLater = "Maybe later";
        const OptionDoNotAskAgain = "Don’t ask again";
        const ExtensionURL = vscode.Uri.parse(
            "https://marketplace.visualstudio.com/items?itemName=ufukty.dim&ssr=false#review-details"
        );

        const choice = await vscode.window.showInformationMessage(
            PromptContent,
            OptionWriteAReview,
            OptionMaybeLater,
            OptionDoNotAskAgain
        );

        await this.context.globalState.update(KeyLastPrompt, Date.now());

        switch (choice) {
            case OptionWriteAReview:
                vscode.env.openExternal(ExtensionURL);
                break;

            case OptionMaybeLater:
                await this.context.globalState.update(KeyDoNotAskAgain, true);
                break;

            case OptionDoNotAskAgain:
                await this.context.globalState.update(KeyDoNotAskAgain, true);
                break;

            default:
                break;
        }
    }

    async onDidChangeConfiguration() {
        this.updateCounters();
        await this.presentPrompt();
    }
}
