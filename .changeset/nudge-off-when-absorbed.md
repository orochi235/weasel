---
"@weasel-js/core": patch
---

A nudge is disabled with `NotApplicable` where it would move nothing, as one rounding absorbs far out near the double range does, after the 2026-11-10 ruling for Align, Distribute, and Flip. `translateNodeOps`, and so `moveNodesOps`, leaves out a node the translation leaves where it was.
