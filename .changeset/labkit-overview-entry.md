---
'@weasel-js/labkit': patch
---

`@weasel-js/labkit/overview` exports `<TrialOverview>`: a floating panel showing a trial's whole content — an instrument-supplied `render`, or a canvas instrument's own layers — with the stage's visible rect and a crosshair where the pointer is. Pressing or dragging in it moves the stage's camera there, and the pointer over it is published into `trial.pointer` as `viewId: 'overview'`, so an instrument's keys work over either view. It ships outside the main bundle.
