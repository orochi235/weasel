---
'@weasel-js/ui': patch
---

Every press in `@weasel-js/ui` that turns into a drag past some travel now reads that travel from the `gestures.dragPx` kit setting, as the list, tree, bar and dock drags already did. `Select`'s opening click, a `Timeline` key drag, a `Slider` region drag, a `ToolPalette` carry and a curved run's drag-to-scroll each used the 4 px default and ignored the setting.
