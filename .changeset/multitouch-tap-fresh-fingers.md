---
'@weasel-js/gestures': patch
---

A two-finger tap fires only when every finger is a fresh press, timed from the first to land: a brief second touch during a one-finger drag, or after a long hold, is no longer a `multitouchtap`.

<!-- entry: fix -->
