---
"@weasel-js/audio": patch
---

A Web Audio synth note whose envelope has no decay and a sustain below 1 now rises to full level through its attack and steps to the sustain, as the worklet voices and `envelopeLevel` already did, instead of ramping to the sustain; a release during that attack no longer jumps the gain up.
