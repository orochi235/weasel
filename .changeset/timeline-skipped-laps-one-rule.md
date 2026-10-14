---
'@weasel-js/animator': patch
---

A timeline frame that skips whole laps fires the same events under `loop: n` as under `loop: true`: the tail of the lap it left, then the lap it lands in, and nothing of the laps in between. Under a lap count it used to fire every skipped lap's events in full, and to report one `lap` to `animator.watch` per lap skipped; it now reports one, carrying the lap reached. Breaking for a handler that counted on a late frame replaying each lap.
