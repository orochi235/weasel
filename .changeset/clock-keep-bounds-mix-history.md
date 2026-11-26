---
'@weasel-js/clock': minor
---

A clock with a `mix` keeps a bounded history, set by the new `ClockSpec.keep`.

`keep` is the ms back from `elapsed` a seek can reach. It defaults to the run's length when the run ends, else two passes, else one minute; `Infinity` keeps everything, as before. A seek further back lands on the earliest time kept. A clock with no `mix` still seeks anywhere.

```ts
createClock({ duration: 2000, loop: true, keep: 10_000, mix: (transport) => mix(K, { transport }) });
```

<!-- entry: api behavior -->
