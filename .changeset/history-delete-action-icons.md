---
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

The undo, redo and delete actions now ship their own icons, so `<ActionBar group="history" />` and `<ActionBar group="edit" />` draw glyphs with no `icons` map. `UndoIcon`, `RedoIcon` and `DeleteIcon` move into `@weasel-js/core`, which the actions need them in; `@weasel-js/ui` re-exports them under the same names with the same props, and `<Icon name="undo" />` draws the same glyph. Core also exports `ACTION_GLYPHS`, the three glyphs' SVG markup, which `ICON_PATHS` now points at.
