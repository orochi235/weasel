---
'@weasel-js/simulation': patch
'@weasel-js/modes': patch
---

Doc fixes. `useSimulation`'s `onEnd` and `alphaMin` said the loop ends only with `alphaTarget` at 0; it ends, as d3-force's does, once alpha falls below `alphaMin`, whatever the target. `ModeDefinition` counted four shortcut fields where it has five, `discard` among them.
