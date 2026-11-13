---
'@weasel-js/font': major
'@weasel-js/core': major
'@weasel-js/renderer': major
---

`cssFontFamily` and `cssFontFamilyLoading` take a weight and a style after the family, instead of an object.

That is how `getFont`, `fontPending` and the other face lookups take them.

```ts
// before
cssFontFamily('Inter', { weight: 700, style: 'italic' });
// after
cssFontFamily('Inter', 700, 'italic');
```

<!-- entry: breaking -->
