---
'@weasel-js/gestures': patch
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

A double-click on a grouped member names its outermost group, so `modeTriggers` enters isolation on it, and repeated double-clicks drill one group further in each time. `<SceneCanvas isolatedGroup>` says which group isolation is working inside; a double-click names the outermost group below it, or the node hit where no group stands between them. `doubleClickTarget` is the one rule, applied by the canvas's body classification: `BodyClassification.doubleClick` carries the named node, a press carries it as `doubleClickBody` to the double click it completes, whose `kind:` targets match it, and the `hitAt` dep reports it as `doubleClick`. `enterPathEdit` stands aside when a double-click names a group. Single clicks are unchanged. Behavior change: a double-click on a grouped path used to open the path in path-edit.
