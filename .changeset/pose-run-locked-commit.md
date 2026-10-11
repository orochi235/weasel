---
'@weasel-js/core': patch
---

A `usePoseRun` run that settled on a node locked in the meantime threw from its commit and left the node drawn at the run's last frame, away from its stored pose. The commit now skips locked nodes, and the run's overrides are dropped however the commit ends.
