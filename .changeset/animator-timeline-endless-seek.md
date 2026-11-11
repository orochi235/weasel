---
"@weasel-js/animator": patch
---

A seek on a timeline with an infinite `duration` lands where it is asked. Its time read `NaN` after any seek, and every frame after.
