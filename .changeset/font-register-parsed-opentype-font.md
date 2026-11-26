---
'@weasel-js/font': minor
---

`registerFontOutlines` takes a font already parsed with opentype.js, and kerns it from GPOS as it does a font it parses itself.

Pass the parsed font as `parsed`, with the bytes it was parsed from as the source; nothing parses them again. The face matches what the default parser builds from the same bytes: metrics, outlines and GPOS pair kerning, extension lookups included, which opentype.js's own `getKerningValue` does not read. The source must be that one font rather than the collection holding it, and `parsed` does not combine with `parser`.

```ts
const font = openTypeModuleOf(opentype).parse(bytes);
registerFontOutlines('Inter', {}, bytes, { parsed: font });
```

<!-- entry: rank=5 new api -->
