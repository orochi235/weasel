---
'@weasel-js/path-tools': major
---

`showOverlayAction` is `createOverlayToggleAction`: it builds the toggle that shows or hides a path-edit overlay.

```ts
// before
const comb = showOverlayAction('comb', 'pathEdit.comb', 'Curvature comb', glyph);
// after
const comb = createOverlayToggleAction('comb', 'pathEdit.comb', 'Curvature comb', glyph);
```

<!-- entry: breaking api -->
