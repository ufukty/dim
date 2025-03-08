# Change Log

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
