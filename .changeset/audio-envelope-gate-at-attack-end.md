---
"@weasel-js/audio": patch
---

A Web Audio synth note whose gate falls exactly on the end of its attack, with no decay, now rises to full level and steps to its sustain before releasing, as `envelopeLevel` and the worklet voices do; `envelopePoints` had ramped it straight to the sustain.
