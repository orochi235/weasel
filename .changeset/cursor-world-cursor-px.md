---
'@weasel-js/cursor': major
'@weasel-js/core': major
---

`cursorWorldSize` is `worldCursorPx`, since it returns the CSS-pixel size a world-sized glyph draws at.

```ts
// before
const px = cursorWorldSize(glyph, worldRadius, scale);
// after
const px = worldCursorPx(glyph, worldRadius, scale);
```

<!-- entry: breaking api -->
