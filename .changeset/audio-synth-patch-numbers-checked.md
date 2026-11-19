---
'@weasel-js/audio': patch
---

`playNote` and `playNoise` throw a `RangeError` at the call on a patch number their voice could not play.

That is a `duration` or glide `ms` that is negative or not finite, a non-finite envelope time or sustain, filter number or partial gain, or a partial decay of `Infinity`. `createNoteKernel` and `createNoiseKernel` refuse the same. Such a voice used to drop as `failed` when it came due, or mix NaN into its bus under `synthVoices: 'worklet'`.

<!-- entry: fix -->
