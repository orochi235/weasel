---
'@weasel-js/animator': patch
'@weasel-js/audio': patch
'@weasel-js/headless': patch
---

Fixes to timeline seeks, the animator's frames, IK input, the audio scheduler and pattern player, and the node raster host.

- A timeline seek past `duration` with laps left lands in the later lap at once: `time()` reads the time in that lap and its sampled tracks show it before the next frame. Before, `time()` read the raw time until the next frame, and a finished timeline that `setLoop` had given laps stayed past its end for good. A seek to the end samples at once too.
- `hostAnimator`'s `tick` and `follow` throw `RangeError` on a time or rate that is not finite. Before, one such frame left every animation's time NaN and the animator stuck mid-frame.
- `solveIk` throws `RangeError` on a `target`, `tip` or `pole` that is not finite, where it returned a pose with every chain joint's rotation NaN.
- A decay on a target with `friction: 1` throws saying a coast on a target needs friction below 1, where it threw about damping the caller never gave. `DecayOptions.friction` documents its range as (0, 1].
- A scheduled callback that stops and starts the audio scheduler no longer leaves two pass timers running, each firing every pass, one of them past the next `stop`.
- A pattern player stopped and started again from its own `onStep` plays once from the new start. Before, the step it was on also booked its next step, so two step chains ran over one count.
- `VoiceHandle.stop(fadeMs)` throws `RangeError` on a fade that is not finite, before touching the voice. Before, an infinite fade threw from the AudioParam and left the voice playing but marked as fading.
- Every audio param write refuses a value or ramp that is not finite before canceling what is scheduled, so a refused write keeps the ramp in flight. A reverb or delay's `setMix` and `setFeedback` keep their old value when the write is refused.
- A node raster host whose page crashed opens a new page for the next render. A crashed page stays open, so every render after it failed.
