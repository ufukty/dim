# Change Log

## 4.2.0

**Added**

- Added the `max` rule config property to prevent accidental matches. ([#65](https://github.com/ufukty/dim/issues/65))

## 4.1.1

**Fixed**

- Fixed losing the toggle state on file rename. ([#73](https://github.com/ufukty/dim/issues/73))

## 4.1.0

**Changed**

- Changed to use editor presence to pause passing selected areas during config edit.

**Fixed**

- Fixed the document toggle delay on split editors. ([#72](https://github.com/ufukty/dim/issues/72))
- Fixed the old decoration types are not disposed after config change. ([#71](https://github.com/ufukty/dim/issues/71))
- Fixed the split editors are not updated on content change. ([#69](https://github.com/ufukty/dim/issues/69))
- Fixed the extension miss the language mode change. ([#68](https://github.com/ufukty/dim/issues/68))
- Fixed the patterns are executed redundantly for each split editor. ([#66](https://github.com/ufukty/dim/issues/66))

## 4.0.2

**Changed**

- Refined the logging for granularity and reach. ([#60](https://github.com/ufukty/dim/issues/60))

## 4.0.1

**Changed**

- Rewrote the README and CHANGELOG.

## 4.0.0

**Breaking**

- Language-specific rule sections now use language identifiers instead of file extensions. Rename keys like `[js]` to `[javascript]`. Use code completion to find the correct identifier for the target language. ([#7](https://github.com/ufukty/dim/issues/7), [#39](https://github.com/ufukty/dim/issues/39))

**Changed**

- Improved invalid config prompts. ([#52](https://github.com/ufukty/dim/issues/52))
- Restructured the code for reading, compiling and caching config; should not affect usage.

**Fixed**

- Fixed a rare case where config cache invalidation was missed. ([#51](https://github.com/ufukty/dim/issues/51))

## 3.2.2

**Changed**

- Reduced the package size to about 200KB.

## 3.2.1

**Changed**

- Minor performance improvement.

## 3.2.0

**Added**

- Opened [Dim Discussions](https://github.com/ufukty/dim/discussions). Report bugs, suggest features and ask questions.

**Changed**

- Raised the minimum required version of Code to 1.99 (March 2025).

**Removed**

- Removed the settings previously deprecated in Dim v3 (March 2025).
- Dropped the only remaining dependency; Dim is now zero-dep.

## 3.1.9

**Changed**

- Updated dependencies with security patches.
- Added a second preview gif to the README.

## 3.1.8

**Fixed**

- Fixed toggling Dim back on not working.

## 3.1.7

**Fixed**

- Fixed the "respect carets" feature causing missed decoration updates when the config was edited in another tab. The issue was degrading the experience of experimenting with new regex rules. Dim now respects carets only when the editor is active.

## 3.1.6

**Fixed**

- Fixed Dim miscalculating the merged range when rule matches intersected.

## 3.1.5

**Changed**

- Significantly reduced flickering, most noticeable when the cursor moved through chunks of code rapidly selecting and deselecting different matches.

## 3.1.4

**Changed**

- Reverted the marketplace page styling to lighter colors.
- Minor whitespace changes in the changelog.

## 3.1.3

**Changed**

- Adjusted the marketplace page styling.

**Removed**

- Removed some presentation-related content from the extension package.

## 3.1.2

**Fixed**

- Fixed Dim continuing to use cached matches even when they had become outdated, in cases where the change happened while the editor was out of focus (e.g. when the user edited the config in another tab).

## 3.1.1

**Changed**

- Further improved responsiveness by caching regex matches for use across consecutive selection-change updates.

## 3.1.0

**Added**

- Dim now respects carets. Areas the user is actively working on or looking at are no longer dimmed.
- Added an option to adjust the update period.

## 3.0.2

**Fixed**

- Fixed decorations not being applied on the last match of every pattern, due to mishandled looping when merging intersecting matches.

## 3.0.1

**Changed**

- New logo.

## 3.0.0

Biggest change since the previous version. Please read the README for more.

**Breaking**

- `rule`, `start` and `end` are no longer supported. Migrate rules to use the `pattern` property. This requires no value alterations in most cases. One exception is when different flags are used, such as `s` for block dimming. For block dimming, use a `"pattern"` value of `"<start>.*<end>"` instead.

**Added**

- Added full support for regex patterns.
- Added regex flag defaults for the workspace, overridable per rule.

**Changed**

- Switched to standard regex matching from the previous line-by-line scanning, contributing significantly to overall performance and stability.
- Tighter lifecycle management for reusing text editor instances and migrating between them for the same document.
- Added more guards against infinite loops.
- Merged intersecting match regions to avoid applying the same decoration multiple times.

## 2.1.3

**Fixed**

- Fixed changelog miss 2.1.2.

## 2.1.2

**Fixed**

- Fixed the persistence issue with the toggle feature. Dim now remembers the last state when the user returns to a document after switching tabs.

## 2.1.1

**Fixed**

- Fixed an issue where enabling, disabling or toggling Dim for the current editor became unavailable for editors opened before the extension activated.

## 2.1.0

**Added**

- Added new commands to enable, disable or toggle Dim for the current editor. ([Issue](https://github.com/ufukty/dim/issues/2#issuecomment-1932602845))

## 2.0.0

**Breaking**

- Altered the configuration schema:
  - `startRule` and `endRule` renamed to `start` and `end`.
  - `opacityTier` renamed to `opacity`.

**Changed**

- Addressed performance issues.
- Improved reaction time to editor changes.

## 1.0.2

**Fixed**

- Fixed misleading examples in the README.

## 1.0.1

**Changed**

- Updated the icon with a different style and resolution.

**Fixed**

- Fixed scan range calculation.

## 1.0.0

**Added**

- Initial release.
