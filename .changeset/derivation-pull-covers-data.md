---
'@weasel-js/core': patch
---

A derived path or pose notices more of what changed in a dependency without being told. The memo behind `derivePath` and `derivePose` used to re-check only each dependency's pose, so a derivation reading a dependency's `data`, its `layer`, or its `path` went stale unless the scene pushed an invalidation. It now re-checks all three; a dependency's path is compared only where the derivation read it, so one that never asks still costs no route. What a derivation may read of a dependency without a push is its node, `pose`, `data`, `layer`, and `path`. Replacing `data` rather than mutating it in place is what the check relies on, as the rest of the kit already does. The dependencies a derivation is handed are now wrappers over the ones the lookup answered, with the same three fields.
