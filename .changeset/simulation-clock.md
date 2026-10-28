---
'@weasel-js/simulation': patch
---

`useSimulation` takes an optional `clock`, a `ClockHandle` from `@weasel-js/clock`. Given one, the simulation runs no frame loop of its own: it steps once per `step` ms of the clock's time (the clock's own `step`, or 1000/60), so the clock's pause, rate and visibility gating govern it, and the host's `useClockLoop` syncs it. A run is built up by stepping and cannot be unwound, so the clock should be declared `seekable: false`; time it goes back, as on a `reset`, steps nothing and leaves the nodes where they are. Time spent stopped or settled owes no steps once `restart` resumes it. `createSimulation` is unchanged, and without a clock nothing changes. This adds API.
