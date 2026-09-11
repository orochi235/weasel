---
'@weasel-js/theme': patch
'@weasel-js/labkit': patch
---

`--wzl-border-strong` now clears WCAG 1.4.11's 3:1 non-text contrast. It sat two
ramp steps off `surface` and measured 1.3–2.4:1 in every mode; it is now
`gray-400` in dark and `gray-500` in light, which passes against every surface.

**Breaking:** `--wzl-border-raised` is removed. It was added for the same job, so
it folds into `border-strong` — replace any reference to it. Checkbox, radio,
slider, switch and toggle-bar edges get visibly stronger in both modes.
