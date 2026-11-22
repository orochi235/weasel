---
'@weasel-js/labkit': minor
---

A trial's canvas, stage or `<TrialSceneCanvas>` can offer rulers and guides, which the trial's Guides menu turns on.

Declare `rulers: true` on `canvas` or `stage`, or pass it to `<TrialSceneCanvas>`; `{ unit, lengths }` names the unit scope and the labeled steps, CSS px by default. The menu switches the rulers, the guides and snapping to them, each off until switched on. A drag off a ruler places a guide, a drag on one moves it, and dropping it back on a ruler removes it, each one undo step. The rulers read a canvas's world through its `worldSpec`, so a centered or y-up world reads correctly. An orbit takes none.

<!-- entry: rank=10 new api -->
