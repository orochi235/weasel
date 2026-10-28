---
'@weasel-js/clock': patch
'@weasel-js/forge': patch
'@weasel-js/labkit': patch
---

Loading a snapshot of a clock with a finite loop count (`loop: n`) brings it back in the pass it was saved in, with its `ended` and time left, where it used to land in the first pass at the saved time within the pass. A trial clock reopened at a position its first run cannot reach yet waits in that pass too. `holdElapsed(handle, position)` in `@weasel-js/clock` holds a clock at a recorded `HeldPosition` across the whole run the way `holdAt` holds a time within a pass, re-placing it as the span changes; a position recorded under another `duration` or `origin` keeps its pass and the time it showed within it. This adds API.

A snapshot whose config turns a trial's clock back on opens the new clock at the snapshot's position. A lab lets go of a trial's snapshot hold when the trial closes.

A trial's clock is made in a layout effect rather than during render, so under StrictMode a `ClockSpec.mix` factory runs once per clock. The clock is there by the first paint, but not in the trial's first render; in that render the trial's clock resolves to none, never to the focused trial's or the lab's.

`useClockLoop` reads the registry's clocks and targets when the registry changes, not on every frame.

`useTrialClock`, `useTrialClockHandle`, `useTrialMix`, `useClockFrame` and `useTransportControl` take a `trialId` of `null`, which resolves no clock and subscribes to none. forge's `useTimeline` uses it so a story with a clock of its own, such as one on an index page inside a lab, no longer re-renders on every frame of the focused trial.
