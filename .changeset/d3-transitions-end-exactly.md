---
"@weasel-js/d3": patch
"@weasel-js/animator": patch
---

A d3 transition leaves every node at exactly its target pose and a numeric `tween` at exactly its `to`; they could end an ulp off (a tween from -10.9 to 21.2 ended at 21.200000000000003). An animator tween with its own `interpolate` or `interpolator` is now handed exactly 1 on its last frame whatever its easing answers there, so it ends at `to` as a tween of numbers already did. `d3Bind`'s `join` refuses a key the scene gives a node other than a mark on the binding's layer with an error naming both, before changing anything.
