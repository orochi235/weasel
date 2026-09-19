---
'@weasel-js/core': patch
---

Add a slew limiter: `slewToward(value, target, dt, { rise, fall })` moves a value toward a target by at most a per-second rate in each direction, and `createSlew` keeps that state between steps. A fast rise with a slow fall is an attack/release envelope; a direction with no rate jumps.
