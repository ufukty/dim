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

function updateCounters(ctx: vscode.ExtensionContext) {
  const uses = (ctx.globalState.get<number>(KeyUseCount) ?? 0) + 1;
  ctx.globalState.update(KeyUseCount, uses);

  if (!ctx.globalState.get<number>(KeyFirstSeen)) {
    ctx.globalState.update(KeyFirstSeen, Date.now());
  }
}

function isTimeToPrompt(ctx: vscode.ExtensionContext): boolean {
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

const OptionWriteAReview = "Write a review";
const OptionOpenAnIssue = "Open an issue";
const OptionMaybeLater = "Maybe later";
const OptionDoNotAskAgain = "Don’t ask again";

const ExtensionURL = vscode.Uri.parse("https://marketplace.visualstudio.com/items?itemName=ufukty.dim");
const IssuesURL = vscode.Uri.parse("https://github.com/ufukty/dim/issues");

async function presentPrompt(ctx: vscode.ExtensionContext) {
  const choice = await vscode.window.showInformationMessage(
    "It's been a while using Dim. Liked it or hated it?",
    OptionWriteAReview,
    OptionOpenAnIssue,
    OptionMaybeLater,
    OptionDoNotAskAgain,
  );

  await ctx.globalState.update(KeyLastPrompt, Date.now());

  switch (choice) {
    case OptionWriteAReview:
      vscode.env.openExternal(ExtensionURL);
      break;

    case OptionOpenAnIssue:
      vscode.env.openExternal(IssuesURL);
      break;

    case OptionMaybeLater:
      await ctx.globalState.update(KeyDoNotAskAgain, true);
      break;

    case OptionDoNotAskAgain:
      await ctx.globalState.update(KeyDoNotAskAgain, true);
      break;

    default:
      break;
  }
}

export async function controls(ctx: vscode.ExtensionContext) {
  updateCounters(ctx);
  if (isTimeToPrompt(ctx)) {
    await presentPrompt(ctx);
  }
}
