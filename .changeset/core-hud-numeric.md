---
'@weasel-js/core': patch
'@weasel-js/labkit': patch
---

Core's stylesheet is now published as `@weasel-js/core/style.css`. Through 1.7.1 it shipped in the tarball as `dist/index.css` with no export and no import, so an installed core drew its debug HUDs with class names and no rules behind them — unpositioned, unbackgrounded text. Import it once if you turn on `cursorCoordsHud`, `pickHud` or `modalityHud`. labkit's `styles.css` now includes it.

`cursorCoordsHud` lays its readings out as a label column and a value column, set in the numeric face, instead of padding a monospace line with spaces. World coordinates write negatives with U+2212. The face is built into core's stylesheet, so installing core still brings no theme dependency. The pick and modality HUDs list ids and stay monospace.
