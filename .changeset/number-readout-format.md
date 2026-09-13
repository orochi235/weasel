---
'@weasel-js/core': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A number pref can name how its value is shown. `ToolPrefNumber.format` is
`'plain'` or `'compact'`, and labkit sets it with
`f.number(0).range(0, 2_000_000).format('compact')`. A compact readout keeps a
value's precision below a thousand and abbreviates above it at one decimal:
`950`, `40.0K`, `2.0M`.

`SliderRow` takes the same choice as `notation`, and its readout reads typed text
through the new `parseNumber`: thousands commas and a `k`/`m`/`b`/`t` suffix are
accepted, so `2.5m` commits 2,500,000. An emptied readout now reverts instead of
committing zero. `formatCompact` and `parseNumber` are exported beside
`formatNumber`.

**A slider readout is no longer narrower than its own values.** The box was a
fixed width, so a six-digit value lost a digit and read as a smaller number. It
now widens to fit the longer of its formatted `min` and `max`, and rows whose
values already fit keep their width. `--wzl-property-readout-w` still sets the
floor.

`NumberRow` and `PrefsForm` ignore the format: one edits through a native number
input that cannot display `2.0M`, and the other's sliders show no value.
