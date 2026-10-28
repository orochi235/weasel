---
'@weasel-js/diagram': patch
---

`useEffectRunner` takes `clock`, a `ClockHandle` from `@weasel-js/clock`, to play on in place of its own frame loop: the play time is the clock's `elapsed`, so pausing, rate, seeking and the clock's visibility gate move the runner with the rest of a trial, and the host's `useClockLoop` syncs it. The runner plays while the clock does, and its `play` and `pause` set the clock's rate. `EffectRunner.seek(seconds)` moves the play time whether or not it plays and runs the pipeline there; a seek made while a run is still going runs once more after it, at the latest time. This adds API.
