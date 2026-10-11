---
'@weasel-js/core': patch
---

A selection too small to hold its corner handles can be moved by its body again. While the target spans under four hit radii on an axis on screen, only the outward half of each corner's hit square on that axis takes a press, so a press inside a 12 px selection reaches the body and no longer resizes. A `point` affordance region opts in with the new `cornerOf` field, and `pointRegionFrame` reports the span that takes a press as `u` and `v`.
