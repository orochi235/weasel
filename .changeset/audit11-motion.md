---
'@weasel-js/audio': patch
'@weasel-js/clock': patch
'@weasel-js/animator': patch
'@weasel-js/headless': patch
---

Fixes to audio voices and patterns, clock syncing, timeline seeks, tween durations and the node raster host.

- A voice's `gain`, `rate`, `detune`, `pan` and `position`, given to `play`, `playNote`, `playNoise` or `stream` or set on its handle, and the position `setListener` takes, throw a `RangeError` when not finite. Before, a real AudioParam threw after the voice had kept the value, and a worklet voice mixed NaN into its whole bus. This newly throws where a non-finite value used to be accepted.
- `setListener` throws a `RangeError` on an option that is not finite (`refDistance`, `maxDistance`, `rolloffFactor`, `panWidth`, `right`). Before, it gave every positioned voice a NaN gain or pan.
- A pattern player's `start` throws on a time that is not finite before it counts itself playing. Before, it threw from the booking and was left reporting `playing()` true with nothing booked, so a later `start` did nothing.
- A full voice pool whose every voice scores NaN steals one, where it found no victim and threw.
- A clock's `sync` throws a `RangeError` on a time that is not finite. Before, one such sync left `elapsed` NaN for good.
- A timeline `seek` before 0 lands on 0, and one past `duration` with no laps left lands on `duration`. Before, `seek(-20)` reported `time()` as -20 and held the playhead at 0 for 20 ms before playing.
- `animator.tween` throws a `RangeError` on an `ms` that is NaN, for a plain tween and a target tween alike. Before, the tween started and its first frame threw out of the animator's frame, stopping every other animation on every frame after.
- `animator.stagger` throws a `RangeError` on a delay that is not finite, a numeric `Infinity` included, before any item starts. Before, that item never fired and the stagger never finished. A delay function is now asked for every index before the first item starts.
- A node raster host whose page or browser has closed opens a new one for its next render, where it failed every render after.
