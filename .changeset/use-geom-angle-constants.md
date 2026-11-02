---
'@weasel-js/core': patch
'@weasel-js/diagram': patch
'@weasel-js/geom': patch
'@weasel-js/hud': patch
'@weasel-js/renderer': patch
'@weasel-js/stroke': patch
'@weasel-js/svg': patch
'@weasel-js/text': patch
'@weasel-js/ui': patch
---

Degree and radian conversions in these packages use geom's `DEG_TO_RAD` and `RAD_TO_DEG` instead of
writing `Math.PI / 180` out by hand. Results are unchanged up to floating-point rounding.
