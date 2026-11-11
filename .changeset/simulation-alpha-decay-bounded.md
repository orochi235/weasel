---
"@weasel-js/simulation": patch
---

Alpha now decays toward `alphaTarget` without passing it. An `alphaDecay` above 1 used to swing alpha past
the target and, far enough above, to `Infinity` within two ticks; it now acts as 1, landing on the target,
and a negative one as 0.
