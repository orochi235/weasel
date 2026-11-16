---
'@weasel-js/ui': minor
---

`Transport`'s time readout shows the playhead over the end time or the time elapsed over the duration, or whatever a `formatTime` returns.

`timeReadout: 'absolute' | 'elapsed'`, default `'absolute'`: the playhead over `start + duration`, or the time since `start` over `duration`. The two read alike when `start` is 0. `formatTime({ playhead, start, duration })` returns the readout's whole text in place of either, handed the playhead held to the timeline; the readout holds the width of the wider of its readings at the start and the end. `AnimatedTransport` takes both.

With a nonzero `start`, the default's second figure is now the end time where it was the duration: a timeline from −0.5 s to 2.5 s reads `-0.50s / 2.50s`.

<!-- entry: api new behavior -->
