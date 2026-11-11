---
"@weasel-js/kernel3d": patch
---

`aimSpace3d`'s `unproject` answers a ground point at height 0 when `up` lies just off an axis, as `createInsert` already lays its footprint at 0. Rounding left in such an `up` (a quarter turn leaves `cos(π/2)` behind) read as a height of about 1e-17.
