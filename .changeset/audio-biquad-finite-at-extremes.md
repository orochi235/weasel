---
"@weasel-js/audio": patch
---

Audio filters stay finite at extreme gains and at very low lowpass or highpass Q, instead of filtering every sample to `NaN`. `biquadCoefficients`, used by worklet and offline voices, clamps gain to the ±1541 dB a `BiquadFilterNode` takes, as the node does.

<!-- entry: rank=-5 fix -->
