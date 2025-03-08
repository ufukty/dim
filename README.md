# dim

![extension icon](media/icon.png)

Define rules to reduce opacity of repeating lines or blocks to be able to focus in main logic.

## Features

- Use simple **regex** rules to describe which part of the code will be dimmed.
- Use `rule` property to make the rule single-line (part of line that matches will be dimmed)
- Use `start` and `end` to make the rule multi-line (matching block of code will be dimmed)
- Write per-workspace rules in `.vscode/config.json` under `dim.rules`
- Write per-language rules under file tags: `[js]`, `[go]`, `[json]`
- 3 opacity tier: min, mid, max. Defaulted to 0.25, 0.50, 0.75 opacities.

## Simple usage

```json
{
  "[go]": {
    "dim.rules": [
      {
        "start": "if err != nil",
        "end": "}"
      }
    ]
  }
}
```

## Detailed usage

Below code demonstrates, 2 per-language rule as well as one per-workspace rule.

- The rule defined for go is multi-line since it has `start` and `end` properties.
- The workspace-wide rule and the rule defined for json are single-line rules since they only have `rule` property.
- `opacity` can be defined per-rule, if another tier then the `defaultOpacity` is desired.
- `defaultScanLimit` is to limit **dim** to search only the first `n` lines of codefiles. Higher values can decrease the performance.
- `maxLinesBetween` is to limit **dim** to search match for the `end` only `n` lines after the the text matches with `start`

```json
{
  "[json]": {
    "dim.rules": [
      {
        "rule": ".*\\$.*" // eg: $schema, $url
      }
    ]
  },
  "[go]": {
    "dim.rules": [
      {
        "start": "if err != nil",
        "end": "}",
        "opacity": "min",
        "maxLinesBetween": 20
      }
    ]
  },
  "dim.rules": [
    {
      "rule": "//.*", // comments
      "opacity": "max"
    }
  ],
  "dim.defaultOpacityTier": "mid",
  "dim.defaultScanLimit": 500,
  "dim.defaultMaxLinesBetween": 5,
  "dim.valueForMinTier": 0.2,
  "dim.valueForMidTier": 0.3,
  "dim.valueForMaxTier": 0.4
}
```

## Todo

- [ ] `ignoreMatchingBraces` is under development
- [ ] Option to leave the inner-area of `start` and `end` matching texts without dimming: `leaveBetween`
- [ ] Context like usage with multiline rule property `subRules`

## Known issues

- Dim rules might not be applied properly when working with TypeScript files. [See issue details and leave feedback](https://github.com/ufukty/dim/issues/3)

## Contribution

- Issues and PRs => https://github.com/ufukty/dim

## License

- See [LICENSE](LICENSE) file

## See also

- dim has inherited some code and logic from https://github.com/lorefnon/lowlight-patterns
