---
'@weasel-js/diagram': patch
---

An `EffectPort` input can take several wires: `many: true` lets `EffectEditor` join a second output to it, and a third, where it used to join only a free input. The same output still cannot be wired to it twice. Every input of the audio stage types now sets it, since the audio runner already sums every wire into an input, so two sounds combine at any stage's input without a Mix. A pipeline saved before this keeps its stages' ports as they were.
