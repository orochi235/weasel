---
'@weasel-js/ui': patch
---

`LayerStackItem.accent` is replaced by `tone`, the same prop `EffectCard` takes: an index into the theme's tone list, which follows light and dark mode, or a color given directly. Breaking for anyone passing `accent`; a color string moves across unchanged as `tone`.
