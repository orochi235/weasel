---
"@weasel-js/diagram": patch
---

An eased live layout now lands each node exactly on its target on the last frame, where it could end a rounding step short (from 10 to `5e-324` it stopped at 0), and stays finite easing between the two ends of the double range instead of passing through `Infinity`.
