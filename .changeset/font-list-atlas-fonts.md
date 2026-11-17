---
'@weasel-js/font': major
---

`listFonts` is `listAtlasFonts`: it lists the atlas tier only, beside `listFontOutlines` and `listCanvasFonts`.

```ts
// before
const families = listFonts().map((f) => f.family);
// after
const families = listAtlasFonts().map((f) => f.family);
```

<!-- entry: breaking api -->
