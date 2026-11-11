---
"@weasel-js/audio": patch
---

`biquadCoefficients`, and so a worklet or offline voice's filter, stays finite for a gain past the ±1541 dB a `BiquadFilterNode` takes (it is clamped there, as the node clamps it) and for a lowpass or highpass Q so far below 0 dB that its resonance underflowed, instead of filtering every sample to `NaN`.
