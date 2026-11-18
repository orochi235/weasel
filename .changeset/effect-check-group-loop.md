---
'@weasel-js/diagram': minor
---

`checkPipeline` reports effect clusters that hold each other in a loop as a `cluster-loop` problem, naming every cluster in it.

`EffectProblem` gains the `cluster-loop` kind and a `clusters` field listing the loop's clusters; `cluster` is the first of them.

<!-- entry: new api -->
