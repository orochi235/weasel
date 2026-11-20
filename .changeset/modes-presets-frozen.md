---
'@weasel-js/modes': patch
---

The shipped modes in `DEFAULT_MODES` are frozen: changing one in place throws rather than changing it for every canvas.

Customize a shipped mode by copying it:

```ts
const normal = { ...NORMAL, allows: [...NORMAL.allows, 'edits-text'] };
```

<!-- entry: fix -->
