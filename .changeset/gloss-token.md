---
'@weasel-js/theme': patch
'@weasel-js/ui': patch
---

Breaking, visually: the default theme draws a primary or secondary `Button` and the selected segment of a `ToggleBar`, `ButtonBar`, or `OptionsBar` flat. Primary and selected are a plain accent fill; secondary is the raised surface inside a 1px `--wzl-border-strong` line, and that line is a look chosen on an agent's judgment with no person having seen it.

Adds a token: `--wzl-gloss`, 0 to 1, how much of the Aqua glass those controls wear. The default theme sets 0. A theme, or any ancestor, that sets it to 1 gets the ramp, specular gloss, rim, and drop shadow back as they were drawn before: at 1 every computed property matches the old glass but for a fully clear layer over the ramp. Values between cross-fade the two.
