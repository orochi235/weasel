---
'@weasel-js/theme': patch
'@weasel-js/labkit': patch
---

`--wzl-border-strong` now clears WCAG 1.4.11's 3:1 non-text contrast. It sat two
ramp steps off `surface` and measured 1.3–2.4:1 in every mode; it is now
`gray-400` in both modes, which passes against every surface except light-mode
`surface-sunken` (2.9:1).

**Breaking:** `--wzl-border-raised` is removed. It was added for the same job and
held the same value, so it now is `border-strong` — replace any reference to it.
Checkbox, radio, slider, switch and toggle-bar edges get visibly brighter as a
result.
