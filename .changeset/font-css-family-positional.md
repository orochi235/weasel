---
'@weasel-js/font': major
'@weasel-js/core': major
'@weasel-js/renderer': major
---

`cssFontFamily` and `cssFontFamilyLoading` take a weight and a style after the family, like `getFont`, `fontPending` and the other face lookups, instead of a `{ weight, style }` object.

```ts
// before
cssFontFamily('Inter', { weight: 700, style: 'italic' });
// after
cssFontFamily('Inter', 700, 'italic');
```

<!-- entry: breaking -->
