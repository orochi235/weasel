---
"@weasel-js/kernel3d": patch
---

`groundGridSource` offers no line along an axis where a probe lies so far out, for its step, that lines a step apart are one number or none is finite, as guides' grid lists none past a safe index. It offered the same line twice there, and lines at `NaN` for a step too fine for the probe's distance from the origin.
