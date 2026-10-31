---
"@weasel-js/ui": patch
"@weasel-js/labkit": patch
---

labkit's `Toolbar` is gone: labkit now re-exports `@weasel-js/ui`'s, which gains what labkit's added. `size="sm"`
gives the compact control height a trial's chrome uses, `framed` draws a strip of its own, `Toolbar.Title` sets the
toolbar's name as a bar's is, and `Toolbar.Button` is the ghost button labkit drew (also exported as
`ToolbarButton`). A labkit toolbar no longer frames itself: a trial's toolbar region passes `size="sm" framed`, the
lab header's does not, and the `lk-toolbar` and `lk-toolbar-title` classes no longer exist.
