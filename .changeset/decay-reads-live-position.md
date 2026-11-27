---
'@weasel-js/core': patch
---

A coasting pan with `bounds` checks them against where the view really is, so a view moved by something else mid-coast still stops, bounces, or springs at its bounds.

`useDecayLoop`'s `start` takes a `position` reader for this; without one it tracks its own sum of steps from `initialPosition`, as before.

<!-- entry: fix api -->
