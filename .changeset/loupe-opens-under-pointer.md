---
'@weasel-js/labkit': patch
---

`<TrialLoupe>` now opens under the pointer when it comes up without the pointer moving — the peek key pressed over a still pointer, or the lens turned on under one. It used to open at the host's top-left corner and sample there until the next move. A peek with the pointer outside the host still shows nothing until the pointer enters.
