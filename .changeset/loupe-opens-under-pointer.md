---
'@weasel-js/labkit': patch
---

`<TrialLoupe>` now opens under the pointer when it comes up without the pointer moving — the peek key pressed over a still pointer, or the lens turned on under one. It used to open at the host's top-left corner and sample there until the next move. A peek with the pointer outside the host still shows nothing until the pointer enters.

The magnified point now sits exactly under the pointer. The lens's ring used to push it one border-width right and down, and inside a lab the ring also narrowed the area the lens draws into by twice its width, shrinking the picture to fit. The ring now sits outside a box that is exactly `diameter` across and centered on the aim.
