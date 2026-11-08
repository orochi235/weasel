---
'@weasel-js/core': patch
'@weasel-js/routing': patch
---

`getAlpha01` reads the alpha of a `#rgba` color too, where it used to answer 1, so `mergeAlphaFromPrev` keeps a short-form color's alpha.
The debug overlay's `ids` feature labels nodes on its own; before, it drew nothing unless `bounds` was on as well.
A devtools panel no longer misses a change made while the page was sending it the previous change notice.
`usePublishPointer` clears the pointer when a press that left the element is canceled outside it, as it already did when one was released there.
Breaking: the type aliases `HandToolInertiaConfig` (use `InertiaConfig`) and `ActionDisabledReasonValue` (use `ActionDisabledReason`, which names the type as well as the table) are removed.
`@weasel-js/core` exports the types its own hooks and defaults are written in: `IconRegistry`, `IconGlyph`, `IconEntry`, `IconVariantState`, `IconVariantLoader`, `Palette` and `PaletteEntry`.
