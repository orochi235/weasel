---
"@weasel-js/ui": patch
"@weasel-js/labkit": patch
---

Add `<Jog>`, a transport for something counted rather than timed — beat 3 of 24 rather than
4.20s of 12.00s. Previous, play/pause, next, an optional scrubber and an `n/m` readout padded
so the row cannot shift as it plays. `<Transport>` remains the continuous-time one.

New `stepBack` glyph, and `step` is now `stepForward`: with two of them, `step` alone no longer
names a direction. `StepIcon` stays as a deprecated alias of `StepForwardIcon`, but the
`IconName` union no longer includes `'step'`.

labkit re-exports `Jog`, `Icon` and the playback glyphs, so chrome built on labkit still needs
no direct `@weasel-js/ui` dependency.
