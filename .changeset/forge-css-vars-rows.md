---
'@weasel-js/labkit': patch
'@weasel-js/forge': patch
---

labkit re-exports weasel-ui's `Input` and `InputProps` from its main entry.

forge's CSS Vars panel shows each variable as one row: its name as written, in
monospace, over a single field holding the value, with the color swatch inside
the field for a color and a Reset button beside it once overridden. The
Theme/Story tabs are flat and full height, and they stay at the top with the
filter while the list scrolls. The list is no longer capped at 60% of the
viewport; it fills the aside.
