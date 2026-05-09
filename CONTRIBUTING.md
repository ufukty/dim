# Contributing

For the users, [Dim GitHub Discussions](https://github.com/ufukty/dim/discussions) is the best medium for sharing bug reports, suggestions and questions.

## Internals

Dim's code may not be straightforward to follow, as it employs several optimization techniques that scatter and intertwine logic across files.

### Overview

The extension starts with the lifecycle controller. It is responsible for routing user events received from VS Code to the correct units. Units include the compiled user-config cache and individual editor decorators. Events include changes in the config, active and visible editors, and selections.

<img srcset="./diagrams/structure@2x.png 2x">

An editor decorator instance is responsible for a single `TextEditor` instance. It holds the UI state, including the per-document toggle and the ranges decorated at the previous iteration.

### Compiled user-config cache

A Dim user-config may contain many RegExes, so compiled results are cached. The compiled config is sensitive to the scope of `TextEditor`. That's a shallow handle VS Code uses to represent a tab's session. Cache invalidation is triggered by the Extensions API event `onDidChangeConfiguration`.

<img srcset="./diagrams/config-cache@2x.png 2x">

Cache keys may shift as VS Code returns different `TextEditor` instances for the same "tab" when the user switches between them.

Tracking tabs through short-lived TextEditor handles.