# Dim

Focus on the main logic easier with dimming down the details.

**Properties**

- Simple to customize
- Fast to run
- Small to download

**Features**

- Regular expressions
- Lines or blocks
- Document toggling
- Language-specific rules

## Features

### Working with Dim

The extension doesn't dim the areas where the user is actively working on.

<img alt="A screen recording of Visual Studio Code editor while the cursor is moved to show dimming is disabled whereever the user selects" src="https://github.com/ufukty/dim/raw/main/media/carets.sepsol.gif" width="668" >

### Toggle for document

Dim can be temporarily turned off for a document.

Use the command palette or assign `dim.toggleDimForCurrentEditor` to a keyboard shortcut.

<img alt="Dim on Go code and toggling feature" src="https://github.com/ufukty/dim/raw/main/media/toggling.gif" width="668" >

### Unapologetically RegEx

Some find RegEx cluttered. Some flexible. You can always start simple and improve the rules over time.

For example, this lil' one combines lookarounds and single line mode with a "strange" pattern to dim the conditional branches of If statements without the condition expression's itself, and allows one level of nesting with additional parentheses and braces. [Regex101](https://regex101.com/?regex=%28%3F%3C%3D%28%3F%3Aelse%7Cif+%5C%28%5B%5E%28%29%5D*%28%3F%3A%5C%28%5B%5E%28%29%5D*%5C%29%5B%5E%28%29%5D*%29*%5C%29%29+%7B%29%5B%5E%7B%7D%5D*%28%3F%3A%7B%5B%5E%7D%5D*%7D%5B%5E%7B%7D%5D*%29*%28%3F%3D%7D%29&testString=if+%28condition%29+%7B%0A++.%0A%7D+else+if+%28expression%28%29%29+%7B%0A++%7B%7D%0A%7Delse+%7B%0A++%7B%7D+%7B%7D%0A%7D&flags=gs&flavor=javascript&delimiter=%2F)

```jsonc
{
  "[typescript]": {
    "dim.rules": [
      {
        "pattern": "(?<=(?:else|if \\([^()]*(?:\\([^()]*\\)[^()]*)*\\)) {)[^{}]*(?:{[^}]*}[^{}]*)*(?=})",
        "flags": "gs",
      },
    ],
  },
}
```

### Language-specific rules

Can't use the same markers for all languages?

Dim accepts language-specific rules and combines with the rules at root.

```jsonc
{
  "[javascript]": {
    "dim.rules": [{ "pattern": "console\\.log\\(.*?\\)" }],
  },
  "dim.rules": [{ "pattern": "TODO: .*" }],
}
```

### Style consistency with tiers

Maintaining the consistency of opacity values across rules while tweaking them is easy. Assign an opacity tier per-rule among `min`, `mid` and `max` and set the exact opacity value at root. Rules also inherit the default tier set at the root.

```jsonc
{
  "dim.rules": [
    { "pattern": "FIXME: .*", "opacity": "max" }
    { "pattern": "TODO: .*", "opacity": "mid" }
    { "pattern": "DONE: .*" } // "min"
  ],
  "dim.defaultOpacityTier": "min",
  "dim.valueForMinTier": 0.2,
  "dim.valueForMidTier": 0.3,
  "dim.valueForMaxTier": 0.4,
}
```

### Preventing accidentals (Experimental)

Dim prevents decoration of big chunks in case of a rule accidentally matches incomplete code with checking if the braces are balanced that otherwise would irritate.

## Performance features

Dim is designed for speed.

### Peek fast

Instead of scroll events, Dim runs after the document reveal and content changes.

### Caching compiled RegExes

Dim caches the compiled RegExes for faster iterations which are correctly invalidated when the Dim config change.

### One-pass match

Instead of iterating lines one-by-one and matching both the start and end tokens individually Dim runs each rule against the full-text.

### Adjustable

Dim can be adjusted to react faster and more frequently to user events as the hardware allows.

### Lightweight

Dim is a zero dependency, bundled extension. It activates around `2ms` and weights around `200KB`. For comparison Prettier takes around `100ms` and Git takes `20ms` in the same system.

## Example configuration

```jsonc
{
  "[go]": {
    "dim.rules": [
      {
        // Dim Go's error wrapping blocks to "mid" tier.
        "pattern": "if err != nil {.*?}",
        "flags": "gs",
        "opacity": "mid",
      },
    ],
  },
  "[javascript]": {
    "dim.rules": [
      {
        // Dim the console.log calls including the args.
        "pattern": "console\\.log\\(.*?\\)",
      },
    ],
  },
  "dim.rules": [
    {
      // Dim the comment lines
      "pattern": "//.*",
      "opacity": "max",
    },
  ],
  "dim.defaultFlags": "g",
  "dim.defaultOpacityTier": "min",
  "dim.valueForMinTier": 0.2,
  "dim.valueForMidTier": 0.3,
  "dim.valueForMaxTier": 0.4,
}
```

## Suggestions

- Escape patterns with backslashes as in the previous examples.

- Patterns allow nested scopes increase the user experience dramatically. See [the test configuration](https://github.com/ufukty/dim/blob/main/test/.vscode/settings.json) for more examples.

- Single line `s` RegEx mode for matching blocks. ([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions#advanced_searching_with_flags), [StackOverflow](https://stackoverflow.com/questions/918806/difference-between-regular-expression-modifiers-or-flags-m-and-s)).

- Toggle using keyboard:
  ```json
  {
    "key": "alt+cmd+h",
    "command": "dim.toggleDimForCurrentEditor"
  }
  ```

## Discussions

[GitHub Discussions](https://github.com/ufukty/dim/discussions) is open for users to report bugs, suggest features and ask questions.

## Prior work

Dim has inherited some code and logic from [lowlight-patterns](https://github.com/lorefnon/lowlight-patterns).

## License

See [LICENSE](LICENSE) file
