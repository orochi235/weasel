---
'@weasel-js/theme': patch
'@weasel-js/ui': patch
---

New `--wzl-workspace` theme token: the whole workspace background as one layer, `--wzl-workspace-surface` struck with diagonal bands of `--wzl-workspace-line`. Use it as an element's `background`. The asset editor's preview stage now paints from it. `--wzl-workspace-surface` is now `--wzl-surface-raised` with its tint taken out (`#272727` dark, `#e7e7e7` light) rather than `--wzl-surface-sunken`, so every workspace drawn from it is lighter than before.

A theme token whose value writes a `var(--wzl-…)` inside it is now redeclared in every mode block when that token varies by mode, the same as a `{token}` reference, so the value resolves against the mode of the element it is used on.
