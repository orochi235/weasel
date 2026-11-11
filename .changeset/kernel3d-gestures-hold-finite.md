---
"@weasel-js/kernel3d": patch
---

`orbitBy`, `dollyBy`, `panBy`, and `dollyToward` leave the camera as it is for an input that is `NaN` or that carries its target, angles, or distance past the double range. A `NaN` turn or dolly used to leave a camera of `NaN` fields, which casts no ray and draws nothing from then on, and a pan past the double range a target of `NaN`.
