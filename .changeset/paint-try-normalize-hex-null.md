---
'@weasel-js/paint': major
---

`tryNormalizeHex` returns `null` for a string that is no hex color, as `tryParseColor` and `parseHexBytes` do, not `undefined`.

```ts
// before
if (tryNormalizeHex(text) === undefined) …
// after
if (tryNormalizeHex(text) === null) …
```

<!-- entry: breaking -->
