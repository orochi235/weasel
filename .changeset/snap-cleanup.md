---
'@weasel-js/geom': patch
'@weasel-js/core': patch
'@weasel-js/kernel3d': patch
'@weasel-js/symmetry': patch
---

Snap pipeline follow-ups.

- kernel3d's `createSnap` takes `kitSettings` and reads its reach from `targets.snapPx` there, as a canvas does (`reachPx` still overrides it), and asks one source per id: a later source with an id replaces an earlier one. Core exports the rule both share as `distinctSnapSources`.
- The symmetry axis knob and a repeat's step handle turn through a `rotate` session on the `snap` dep: they now snap to quarter turns and other nodes' angles without Shift, Shift keeps the 15° steps, Ctrl suspends snapping, and the angle readout draws. Breaking: `handleChange` takes a `SymmetryHandleSnap` (`{ point, angle }`, new export) in place of its `stepped` flag and point function. Without a `snap` dep the handles do not snap, Shift included.
- `resolveSnap` keeps every required candidate past `poolSize`, so Shift's steps can no longer be crowded out by 24 nearer targets, and drops a candidate with a non-finite locus direction instead of treating its line as a point.
- A move begins its snap session once the drag passes its threshold, so a click on a selected body reads nothing for snapping, and its `geometry` probe is placed within the canvas's reach rather than a fixed 8px.
