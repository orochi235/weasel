---
'@weasel-js/core': patch
---

Breaking: a move behavior moves the drag by returning `transform`, and nothing else. `BehaviorResult.pose`, the deprecated override that was turned into a translate for the first dragged id, is gone, and so is the deprecated `BehaviorMoveResult` alias of `BehaviorResult`. Return `{ transform: { kind: 'translate', dx, dy } }`.

A move gesture's context carries `offset(from, to)`, the translation between two poses' bounds, so a behavior that knows where a node lands can return it as a `transform`. `snapToContainer` does.
