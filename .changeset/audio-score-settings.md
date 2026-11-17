---
'@weasel-js/audio': major
---

`scoreParams` is `resolveScoreMood` and its result type `ScoreSettings`; "params" is the kit's word for the settings-editing surfaces.

```ts
// before
const settings: ScoreParams = scoreParams(mood);
// after
const settings: ScoreSettings = resolveScoreMood(mood);
```

<!-- entry: breaking api -->
