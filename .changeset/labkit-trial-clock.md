---
'@weasel-js/labkit': patch
---

An instrument can declare `clock` to give its trials playback time labkit owns: a position, `elapsed`, moved by a signed `rate` (0 pauses, negative plays backward), with `ramp`, `seek`, `loop`, `pass` and `phase`. A canvas layer marked `timed` repaints every frame the clock moves and reads `elapsed`, `pass` and `phase` in its draw args; `useClockFrame` runs a callback per frame without re-rendering; `useTrialClock(trialId?)` reaches a trial's clock from inside it or from the lab's chrome. One frame loop per lab drives every clock and sleeps when all are paused. `seekable: false` makes a clock forward-only. Reset returns the clock to 0, and `TrialRecord.clock` keeps where it stood across a reload. `<CanvasStack>` takes `ticks`, and a layer descriptor `timed`, for the same repaint outside a trial.
