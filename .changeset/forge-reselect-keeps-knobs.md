---
'@weasel-js/forge': patch
---

`Workshop`: picking a story in the tree when the focused trial already shows it no longer resets that trial's knobs. It did whenever the URL named another story or none, such as a workshop opened at its bare address with a restored trial: the route was written with no knobs, and the trial was then set to match it. The route now starts with the knobs the trial holds.
