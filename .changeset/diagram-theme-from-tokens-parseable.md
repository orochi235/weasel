---
'@weasel-js/diagram': patch
---

`diagramThemeFromTokens` takes `paper`'s color for a token that does not parse as a color.

The shipped `--wzl-fg-muted` is relative color syntax, so "Match chrome" had painted muted text and connectors with it and saved a theme that did not check.

<!-- entry: fix visual -->
