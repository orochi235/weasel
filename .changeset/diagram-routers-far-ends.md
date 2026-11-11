---
"@weasel-js/diagram": patch
---

The `orthogonal` and `bezier` routers stay finite between ports and waypoints near the ends of the double range. `orthogonal` turned at an `Infinity` midpoint between two far ends on one side, and `bezier` drew a leg of `NaN` points where its length overflowed.
