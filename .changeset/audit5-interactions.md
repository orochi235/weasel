---
'@weasel-js/core': patch
---

Fixes from an audit of core's interactions:

- A rotate drag whose pointer swings past the left of the pivot keeps turning the way it was going; the turn jumped a whole circle there, so a 100° counterclockwise drag committed 260°.
- A resize of a multi-selection or group updates `ctx.current` as it goes, so a constraint's `onEnd` reads the box the drag left rather than the one it started from.
- An insert whose release commits nothing — a behavior aborted it, or the drag ended too small to draw — puts back the selection its press cleared, as a cancel already did.
- A second finger pressed on a `useDragHandle` handle mid-drag is ignored; it used to orphan the first drag, so unmounting left its ghost in the page and blocked every later drag.
- `useDragGesture`, `useDragRect` and `useDragRadial` close the gesture and clear the overlay when an `onCancel` throws.
- `useHandleDrag` reports `moved: false` for a pointermove that never left the press point.
- An Alt-drag clone, a nudge and `commitOps` report nothing committed when the scene's arrival handler refuses the batch; a refused clone told its behaviors it committed and recorded a duplicate for transform-again.
- An insert preview on a parallax layer draws its quantized landing box and its container copies where the shape will land.
