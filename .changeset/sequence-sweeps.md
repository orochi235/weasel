---
'@weasel-js/ui-logic': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

Add `<Sequence>`: one component repeated over the steps of a parameter

- `Sweep` (ui-logic) is a parameter's domain, apart from how it is walked: `at(u)` reads it as a scrubber does, one value from 0 to 1 along it, and `walk()` reads every step at once. `range` (by `step`, or `count` samples), `values`, `frames` (a clock's run, `every` ms apart, one pass or `passes: 'all'`) and `until` (stop before the first step a predicate accepts) build one; `stepsOf` takes up to a cap from one that never ends.
- `<Sequence sweep>` (ui) renders its child once per step, captioned with the sweep's label, wrapped or as one scrolling strip. Given `across`, a second sweep, it lays out every pairing as a grid with its rows and columns labeled. Each cell is live. This is new API.
- `<HeldClock spec at>` (labkit) gives what renders inside a clock of its own, paused at `at`, which `useTrialClock` and `useClockFrame` read in place of the trial's; a clock that is not seekable is run there `step` ms a frame. `<ClockFrames spec every>` is a `<Sequence>` of a clock's frames, each under one.
- `fieldSweep(node)` (labkit) walks the values a config field's control offers: a number's stops or its range by its step, an enum's options, a boolean's off and on.
