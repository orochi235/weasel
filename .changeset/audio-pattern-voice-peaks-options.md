---
'@weasel-js/audio': major
---

`PatternLoadOptions` is `PatternVoicePeaksOptions`, named for `patternVoicePeaks`, which takes it.

```ts
// before
const opts: PatternLoadOptions = { tempo: 120 };
// after
const opts: PatternVoicePeaksOptions = { tempo: 120 };
```

<!-- entry: breaking api -->
