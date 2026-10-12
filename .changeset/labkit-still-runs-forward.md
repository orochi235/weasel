---
'@weasel-js/labkit': patch
---

Adds API, on an agent's judgment: `ClockCapability.step`, the ms a frame at which labkit runs a clock forward with nothing shown. A still at a time (`<Lab still={1200}>`, `?still=1200`) of a clock that is not seekable used to warn and stay where the clock opens; with a `step` declared it is now played forward to that time, every `useClockFrame` reader hearing each step, before the still says it is ready. Without a `step` it stays where it opens, as before, and the warning names the option. A run that ends sooner stops at its end.
