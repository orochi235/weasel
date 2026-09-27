---
'@weasel-js/labkit': patch
---

A trial's own zoom buttons, its zoom slider and its actual-size button now zoom
through the trial's camera, the way the lab header's zoom does: about the middle
of the view rather than the frame's origin, and inside the instrument's
`minZoom` / `maxZoom`.
