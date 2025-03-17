# Change Log

## 3.1.7

- Fixes passing selected areas feature causing user to mis important decoration updates while updating the config in another tab aside. The issue were degrading the user experience for experimenting on new regex rules. Now, Dim respects carets only when the editor is active.

## 3.1.6

- Fixes Dim miscalculating the merged range for rules match intersecting parts of code.

## 3.1.5

**Performance improvement**

- This release significantly reduces the possibility of flickering issue to occur which were best noticable when cursor is moved through chunks of code to rapidly select/deselect different matches.

## 3.1.4

- Reverts the marketplace page styling of extension to lighter colors.
- Minor changes in whitespaces in changelog.

## 3.1.3

- Removes some presentation related content from the installation.
- Adjusts the marketplace page styling of extension.

## 3.1.2

- Fixes dim trying to keep using cached matches even when they become outdated, if the change happened when the editor is out of focus, which is the case when user use another editor (tab) to edit config.

## 3.1.1

**Performance improvement**

- Further increases the responsiveness of Dim by caching the regex matches to use on consecutive selection change updates.

## 3.1.0

**New**

- Dim now respects carets! Means that Dim won't dim those areas that you are actively working on, or looking to. Technically speaking; whenever a pattern matching area intersects with any of the selected portions of the document Dim will pass that match without dimming it. On top of that, multiple selections are respected too. Just try "Select All Occurances of Find Match" command on any of the dimmed areas to see its effect.
- Dim now lets you to adjust the update period. You can select the best value between your caret moving pace and the hardware performance. Lower values are better for usability but might cause perf ormance issues on lower end hardware.

## 3.0.2

- Fixes decorations are not applied on the last match of every pattern due to the mishandled looping on merging intersecting matches.

## 3.0.1

- New logo

## 3.0.0

Biggest change since the previous version. Please read the readme for more.

**New**

- Full support to regex patterns.
- Set regex flag defaults for workspace and override it per rule.

**Performance improvements**

- Switches to standard regex matching from previous line-by-line scanning which contributes a lot to overall performance and stability.
- Thighter lifecycle management for reusing text editor instances and migrating from one to another for same document.
- More checks against infinite loops.
- Merging intersection regions for avoiding applying same decoration multiple times at one part.

**Breaking changes**

- `rule`, `start` and `end` are no longer supported. Migrate your rules to use `pattern` property. Which requires no additional value alterations most of the time. One exception is when you use different flags such as `s` for block dimming. Also for block dimming, use `"pattern"` value of `"<start>.*<end>"` instead.

## 2.1.3

- This version is only for updating the changelog, oops. Please read the log for previous version.

## 2.1.2

- Fixes the persistency issue of toggling feature. Now Dim should remember the last state after user returns to the same document after switching tabs.

## 2.1.1

- Fixes an issue leads enabling/disabling Dim for current editor becoming unavailable for the editor open before extension gets activated

## 2.1.0

- new commands for users to enable, disable or toggle Dim for current editor. [Issue](https://github.com/ufukty/dim/issues/2#issuecomment-1932602845)

## 2.0.0

- addresses performance issues
- improves reaction time to editor changes
- alters configuration schema
  - `startRule` and `endRule` renamed as `start` and `end`
  - `opacityTier` renamed as `opacity`

## 1.0.2

- Fix: Misleading examples in readme

## 1.0.1

- Fix: Scan range calculation.
- Icon has changed with different style and resolution

## 1.0.0

- Initial release
