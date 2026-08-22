---
'@weasel-js/audio': patch
---

`AnalyserTap.bands(n, out?)` takes a scratch array and returns the narrowed type

`bands` is meant for a per-frame render loop but allocated a new `Float32Array`
on every call. It now accepts an `out` array to fill, like `frequencies` and
`waveform` do. `out` must be exactly `n` long — a short one would return fewer
bands than asked for with nothing in the result to say so — and mismatches
throw.

The return type is `Float32Array<ArrayBuffer>`, matching the byte readers.
Assigning the result into a binding typed from `new Float32Array(n)` no longer
fails to typecheck.
