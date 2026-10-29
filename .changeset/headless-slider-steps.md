---
'@weasel-js/headless': patch
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

`@weasel-js/headless` holds the arrow-key step sizes and a slider's value math, so a DOM slider and a canvas-drawn one step alike. `arrowSteps`, `arrowMove` and `rangeKey` read a key string and Shift: one step, or `COARSE_STEPS` (ten) with Shift or a Page key, and Home and End for a range's ends. `sliderKey` is the value one key moves a thumb to, and `usableStops`, `attract` and `clampOrdered` are the stop and ordering rules `Slider` uses. core's node and anchor nudge and ui's `Slider`, curve, gradient, band and timeline editors all take their steps from it.

`ResizeHandle` now moves ten steps with Shift held, not eight, matching every other arrow-key control in weasel.
