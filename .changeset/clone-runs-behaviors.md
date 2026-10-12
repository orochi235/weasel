---
'@weasel-js/core': patch
---

The `clone` action runs the behaviors on its binding, as move, rotate, and insert do. A `CloneBehavior<TPose>` is told the originals, reshapes the drag's translation from `onMove`, and may claim or abort the commit from `onEnd`; `onCancel` and `onSettled` run as they do for a move. A move behavior that only reshapes the translation works as one, so `behaviors: [snap(strategy)]` on the alt-drag binding lands the copy on the grid.

Breaking: `CloneBehavior` is that `ActionBehavior` now, not the `{ id, activates, onEnd(pose, { adapter }) }` shape no action had read since `useClone` was removed. `cloneByAltDrag`, `ClonePose`, and `CloneLayer` are gone: the binding's `mods: { alt: true }` is what gates the clone. `CloneBehaviorResult` is new. Built on an agent's judgment, over deleting the contract.
