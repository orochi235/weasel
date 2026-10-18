---
'@weasel-js/animator': patch
---

A loop played backward now runs back through every pass before the one in flight, not just that one. Once the pass in flight is back at its start, the loop starts the pass before it at its end and plays it back, down to the start of pass 0, where it ends and `onDone` runs. The factory is handed each earlier pass's own index, and turning the loop forward again partway carries on from there. A tween, with `onTick` or on a target, starts at its end when a loop playing backward starts it, and a loop with a `count` started that way starts its last pass at that pass's end. A spring, a decay, a timeline, or a stagger started by such a pass starts at its start as before.
