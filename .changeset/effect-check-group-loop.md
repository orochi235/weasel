---
'@weasel-js/diagram': minor
---

`checkPipeline` reports effect groups that hold each other in a loop as a `group-loop` problem, naming every group in it.

`EffectProblem` gains the `group-loop` kind and a `groups` field listing the loop's groups; `group` is the first of them.

<!-- entry: new api -->
