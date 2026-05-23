# Contributing

If you'd like to contribute, the best way right now is to open a bug report, suggestion, or question on [Dim GitHub Discussions](https://github.com/ufukty/dim/discussions). PRs and issues aren't being accepted from users at this stage.

## Internals

Dim's code may not be straightforward to follow, as it employs several optimization techniques that scatter and intertwine logic across files.

### Overview

The extension starts with the lifecycle controller which is responsible for routing user events to correct units. Units include the editor and document controllers and the compiled user-config cache. Events include changes in the config, active and visible editors, and selections.

<picture>
  <source srcset="./diagrams/structure@2x.png 2x">
  <img srcset="./diagrams/structure@2x.png 2x">
</picture>

### Editor and document controllers

The extension tracks state using document and editor controllers for both the individual "TextDocument"s and their "TextEditor"s. Editor controllers hold UI-related state, including the ranges from previous iteration. The document controller is responsible of executing the effective RegEx patterns and providing them to editor controllers from cache.

The per-document toggle state is stored above both, inside the lifecycle controller.

### Editor controller lifecycle

The editor controllers might be unexpectedly short-lived. They are created and destroyed with editors appear and disappear.

### Compiled user-config cache

A Dim user-config may contain many RegExes, so compiled results are cached. The compiled config is sensitive to the scope of `TextEditor`.

<picture>
  <source srcset="./diagrams/config-cache@2x.png 2x">
  <img srcset="./diagrams/config-cache@2x.png 2x">
</picture>

Cache keys may shift as VS Code returns different `TextEditor` instances for the same "tab" when the user switches between them.

### Matched ranges cache

Document controller caches the matched ranges which allows editor controller readjust decorations to selections faster.

<picture>
  <source srcset="./diagrams/ranges-cache@2x.png 2x">
  <img srcset="./diagrams/ranges-cache@2x.png 2x">
</picture>
