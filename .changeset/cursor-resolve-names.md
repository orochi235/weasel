---
'@weasel-js/cursor': major
'@weasel-js/core': major
---

`resolveCursor` returns the `ResolvedCursor` tier, and `cursorCss` returns the CSS cursor value.

`resolveCursor` was `resolveCursorTier`, and `cursorCss` was `resolveCursor`.

```ts
// before
const tier = resolveCursorTier(spec);
element.style.cursor = resolveCursor(spec) ?? '';
// after
const tier = resolveCursor(spec);
element.style.cursor = cursorCss(spec) ?? '';
```

<!-- entry: breaking api -->
