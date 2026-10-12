---
'@weasel-js/renderer': patch
'@weasel-js/core': patch
---

A group can join what is under it by any Porter-Duff operator. `GroupDrawCommand.composite` and `LayerGroup.composite` are new API, taking a canvas 2D operator name (`xor`, `destination-out`, `source-in`, `lighter`, `copy`, and the rest of that family) or a `{ source, destination }` pair of blend factors for an operator with no name. The types `CompositeOp`, `BlendFactor`, and `BlendFactors` are exported from `@weasel-js/renderer` and from core's barrel. A group with an operator other than `source-over` is isolated: its children draw into a buffer of their own and the operator applies once, to the finished surface, across the whole target inside the enclosing clip. The culler keeps such a group even when every child is off screen, because an empty source still changes the destination. The operator set and the factor-pair form were chosen on an agent's judgment.
