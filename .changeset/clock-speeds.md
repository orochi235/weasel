---
'@weasel-js/clock': major
---

A clock's offered speeds are `speeds`, and their default is `CLOCK_SPEEDS`, since they are unsigned and `rate` is signed.

The `ClockSpec` option and the `Clock` field `rates` are `speeds`; the constant `CLOCK_RATES` is `CLOCK_SPEEDS`.

```ts
// before
const { clock } = createClock({ rates: [0.5, 1, 2] });
clock.rates;
// after
const { clock } = createClock({ speeds: [0.5, 1, 2] });
clock.speeds;
```

<!-- entry: breaking api -->
