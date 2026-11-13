---
'@weasel-js/theme': minor
'@weasel-js/ui': minor
'@weasel-js/labkit': minor
---

A disabled control turns gray as well as fading, so it no longer reads like subtle text beside it.

The cue is the new `--wzl-disabled-filter` theme token, `grayscale(1)` by default; a theme can set it to another filter, or to `none` to keep the fade alone. A consumer stylesheet that fades its own control when disabled sets `filter: var(--wzl-disabled-filter)` beside the `opacity` to match.

<!-- entry: api visual -->
