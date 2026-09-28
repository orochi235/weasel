---
'@weasel-js/diagram': patch
---

A live `force` run now finishes when the graph stops moving rather than when alpha cools. It ends once no node has moved `restDistance` world units (default 0.1) for `restTicks` ticks in a row (default 5), which on a small graph is a few dozen frames instead of three hundred. Nothing rests while a node is being dragged. `restDistance: 0` restores the old behavior. Both options, and `dragAlpha`, are now accepted through `useLiveLayout`'s `force` option.
