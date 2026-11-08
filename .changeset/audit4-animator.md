---
'@weasel-js/animator': patch
'@weasel-js/geom': patch
---

- A nested timeline's `duration` now ends it: its events past that time no longer fire or book, and its sampled tracks hold where they stand at it, as a root timeline does at its own.
- A timeline seeked from inside an event's handler goes on from where the seek landed: the rest of the span the frame crossed no longer fires, the events after the seek fire on the replay, and a seek from the last edge no longer calls `onDone` early or skips it at the end of the replayed pass.
- `TimelineHandle.seek` throws a `RangeError` on NaN or an infinite time, which used to leave the timeline stuck.
- `easeInSine` and `easeInBack` now return exactly 1 at t=1, and `easeOutBack` exactly 0 at t=0, so a tween with a discrete `interpolate` lands on `to`.
