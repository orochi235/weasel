---
'@weasel-js/audio': patch
---

Synth voices as samples, with no `AudioContext`. `renderNote` and `renderNoise` return a whole `playNote` or `playNoise` voice as a `Float32Array`, through its release, to put in an `AudioBuffer` and `register`. `createNoteKernel` and `createNoiseKernel` render the same voice a block at a time, with `release()` and `retune()`, for use inside an `AudioWorkletProcessor`. They cover every wave, inharmonic partials, glide, the envelope, and the voice filter with its cutoff envelope; a square, sawtooth, or triangle is band-limited, and a harmonic past Nyquist is left out. `biquadCoefficients` and `biquadResponseDb` are the filter math under them: a `BiquadFilterNode`'s coefficients by the Web Audio formulas, and what they pass at a frequency. Additive.
