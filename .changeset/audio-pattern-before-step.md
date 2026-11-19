---
'@weasel-js/audio': minor
---

`createPatternPlayer` takes `beforeStep`, called before a step's events are booked, so events and a tempo set there apply to that step.

```ts
createPatternPlayer(engine, {
  tempo: 120,
  beforeStep(step, when, count) {
    if (step === 0) player.setEvents(nextBar());
  },
});
```

<!-- entry: api new -->
