---
'@weasel-js/clock': major
'@weasel-js/labkit': major
---

`ClockSpec.mix` is handed the clock's blits transport and makes its mix on it.

The mix's time is then the clock's `elapsed`, and seeks, rate and reverse play reach it directly. It takes no `history` of its own: the transport keeps it. `ClockedMix` now asks only for `now`, and `createClock` throws when the mix made is not on the transport it was given.

```ts
// before
clock: { mix: () => mix(K, { history: { ms: 10_000, tape: createHistory } }) }
// after
clock: { mix: (transport) => mix(K, { transport }) }
```

<!-- entry: rank=10 breaking api -->
