---
'@weasel-js/audio': major
---

Audio's constant tables are `PARTIAL_PRESETS`, `SCORE_CUES` and `SCORE_MODES`, in SCREAMING_CASE like the rest.

They were `partialPresets`, `scoreCues` and `scoreModes`.

```ts
// before
const bell = partialPresets.bell;
// after
const bell = PARTIAL_PRESETS.bell;
```

<!-- entry: breaking api -->
