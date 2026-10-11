---
'@weasel-js/core': patch
---

A timeline track can move a target, a value can be held on one, and an animation's clock now starts with its frame.

- `animator.hold({ target, value, weight? })` shows `value` on a target in place of its committed value until canceled or released: a drag preview, a value driven from outside. `value` and `weight` are plain or functions read each frame; the handle's `touch()` says a function's answer changed between frames. Animations on the target add on top of a hold. Several holds on one target show their weighted average, and whatever their weights leave short of 1 goes to the committed value. Canceling or `release()` commits what the hold was showing, so the target stays put; `release({ commit: false })` lets it fall back. A hold of plain values does not keep the frame loop running. `'hold'` is a new `AnimationKind`.
- `SampledTrack` takes `target` and `weight`, and `onTick` is now optional. While the playhead is within the track's keys the target shows the sampled value, the same frame the playhead moves, including after a seek and across a loop seam. Past its last key, or when the timeline finishes or is canceled, the target keeps the value it was showing. Before its first key the track leaves the target alone.
- **Behavior change:** an animation started while the animator is already running counts its time from the last frame, not from the moment of the call. Its first frame then advances by the whole frame, as the value it shows always did, so a tween's end, a timeline's playhead, and its events line up frame for frame. An animation started between frames reaches a given time up to one frame sooner than before. Starting on an idle animator is unchanged.
