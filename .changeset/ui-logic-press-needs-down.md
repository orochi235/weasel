---
"@weasel-js/ui-logic": patch
---

`pressStep` takes a hold on a move over the control only while a press that went down on it is still down, so a move and release with no press down no longer count as a press; `PressState` gains `down` to say so.
