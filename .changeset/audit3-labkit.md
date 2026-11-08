---
'@weasel-js/labkit': patch
---

- `ExportMenu` exports a target that still exists once the one it had chosen is gone, instead of failing with "no annotation target".
- `LabBoundary` hides every context a lab or a trial publishes, so a trial clock, a camera, the lab's commands and its lightbox no longer reach what is under it.
- The Pixel grid clears when its capture fails, instead of leaving an unhandled rejection and the old grid.
- A custom or dialog row offers no auto toggle where unpinning it would close a resolver cycle, as a plain row already did.
- A trial's next default snapshot name is one none of its snapshots holds, so deleting one no longer repeats a name.
