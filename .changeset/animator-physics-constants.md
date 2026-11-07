---
'@weasel-js/animator': patch
---

A spring or physics animation handing values to `onTick` with a mass of 0 or below, a negative damping or stiffness, or a constant that is NaN, ran on for good, ticking NaN or a value running away. It now throws, as the same constants on a target do. A decay with `friction` outside (0, 1] throws saying so, where 0 threw an error from deep inside the engine and above 1 sped up for good.
