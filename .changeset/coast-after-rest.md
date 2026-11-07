---
'@weasel-js/core': patch
---

A drag the pointer held still before letting go no longer coasts. The hand tool's inertia and the `momentum` move behavior measured the throw over the last moves the pointer made, however long before the release they were, so a quick drag that paused and then released still flew off at the drag's speed. `VelocityTracker.getVelocity` takes the time to measure at.
