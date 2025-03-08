# dim

![extension icon](media/icon.png)

Define rules to reduce opacity of repeating parts of code to make the main logic pop. Great for dimming Go's `if err != nil { return fmt.Errorf(...) }` error wrapping blocks and JavaScript's `console.log` calls.

## Features

- Define rules based on standard **regex patterns**.
- Supports optional **regex flags**. With sensible defaults, for those who are not comfortable with flags.
- Matches both single line expressions, or **blocks of code**.
- Allows **per-workspace** rules via `.vscode/config.json` file, and **per-language** rules under through language tags `[js]`, `[go]`, `[json]` etc.
- Let's developers maintain high consistency of opacity values across every rule effortlessly by allowing them to set only the **opacity tier** to rules. So, adjusting one tier's value is enough to update all rules using it.
- **Toggling** (enabling/disabling) the extension per document: `dim.toggleDimForCurrentEditor`.
- Checks matched ranges to see if the number of opening `{` and closing `}` **braces** inside match which is to eliminate the problems like partial dimming of blocks or dimming incomplete parts of the code. (Experimental)

## Performance

Dim designed to work with high performance even in lower end machines.

- No scroll hook: some alternative extensions use scroll hook to apply decorations in visible ranges actually reduces the scroll performance in lower end machines. Dim performs scanning and applying decorations at document's first open, and after each content change with some delay.
- Uses regex match on whole document rather than walking the document line by line to invoke regex engine at each line.
- Robust editor lifecycle tracking. Dim tracks lifecycle updates that requires decoration updates or reusing same or different TextEditor instances for the document; does the needed and ignores the rest.
- Dim is field tested for Code extension gotchas eg. constant feedback on applying decorations on log pane leads to infinite loop.

## Usage

```json
{
  "[go]": {
    "dim.rules": [
      {
        "pattern": "if err != nil {.*?}",
        "flags": "gs",
        "opacity": "mid"
      },
      {
        // advanced version that forgives nested blocks and whitespaces
        "pattern": "if\\s+err != nil\\s*{(?:(?:[^{}]|\\n)*{(?:[^}]|\\n)*})?(?:[^}]|\\n)*}",
        "flags": "gs",
        "opacity": "mid"
      }
    ]
  },
  "[js]": {
    "dim.rules": [
      {
        "pattern": "announce\\(.*\\);?"
      },
      {
        "pattern": "logger\\.verbose\\([^\\n]*\\);?"
      }
    ]
  },
  "dim.rules": [
    {
      "pattern": "//.*", // comment lines
      "opacity": "max"
    }
  ],
  "dim.defaultFlags": "g",
  "dim.defaultOpacityTier": "min",
  "dim.valueForMinTier": 0.2,
  "dim.valueForMidTier": 0.3,
  "dim.valueForMaxTier": 0.4
}
```

## Suggestions

- Use proper escaping in pattern values; just like the examples above.
- Use singleline regex mode (with `s` flag) for block dimming rules. See [MDN page for regex flags](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions#advanced_searching_with_flags) or [this Stackoverflow answer](https://stackoverflow.com/questions/918806/difference-between-regular-expression-modifiers-or-flags-m-and-s) if you are not comfortable with the singleline mode.

## Contribution

Report bugs to encourage me to fix them since knowing people using this extension is the only way to do it.

- Issues and PRs => https://github.com/ufukty/dim

## Prior work

- dim has inherited some code and logic from https://github.com/lorefnon/lowlight-patterns

## License

- See [LICENSE](LICENSE) file
