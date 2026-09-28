---
'@weasel-js/hud': patch
---

A bare HUD window whose interior passes (`titlebar: false, interior: 'pass'`) can be moved again: it grows a dotted grip strip across its top, sized by the new `metrics.grip` (14 CSS px by default), and dragging it translates the window. The interior still passes input, and the content rect now starts below the strip.
