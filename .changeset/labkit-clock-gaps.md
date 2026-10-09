---
"@weasel-js/labkit": patch
"@weasel-js/ui": patch
---

A trial clock's `duration` is now writable, for a run whose length follows its content; a write keeps `pass` and `phase`. A `ClockCapability` can say where a run opens (`start`, a time or `'end'`) and which speeds a transport offers (`rates`), and weasel-ui's `<Transport>` takes `rates` to match, with `formatRate` for a speed that reads better in the lab's own units; `<TrialTransport>` and the presented transport pass it through.

`<Lab clock>` gives a lab a clock of its own. An instrument declaring `clock: 'lab'` plays on it, so its trials share one time, and `useTrialClock` and `useClockFrame` fall back to it outside any trial. `useClockFrame` now takes a `trialId` and resolves its clock the way `useTrialClock` does.

`<Lab>` also takes `opening`, the instruments a new lab opens a trial of each, and `documentTitle`. `transport={{ minWidth }}` sets the width below which a presented trial hides its play controls, which used to be a fixed 480px.

`TrialRecord.clock` is now a `ClockPosition`, which carries a changed `duration` beside `elapsed` and `rate`.
