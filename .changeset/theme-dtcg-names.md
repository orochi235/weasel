---
'@weasel-js/theme': major
---

Theme's DTCG reader and writer are `fromDtcg` and `toDtcg`.

`loadDTCG` parsed a document already in memory and loaded nothing, and the repo spells the acronym `Dtcg`, like `DtcgDocument`. `toDtcg` is in `@weasel-js/theme/engine`.

```ts
// before
const theme = loadDTCG(json); const doc = toDTCG(theme);
// after
const theme = fromDtcg(json); const doc = toDtcg(theme);
```

<!-- entry: breaking api -->
