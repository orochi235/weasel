---
"@weasel-js/core": patch
---

The minimap's scene fit and the scene text editor read a derived pose rather
than the placeholder a derived node authors. `computeFitView`'s `'scene'` fit
frames on `documentPose`, so a derived node is framed where it actually is
while a drag still leaves the framing alone; `useSceneTextEdit` resolves both
its double-click hit test and the overlay's own projection through
`effectivePose`, so double-clicking a derived label opens the editor on it and
the box lands on the text.

Removes `UseMoveOptions.cascadeWorldPose`. Nothing has read it since the move
action started walking `scene.childrenOf` for its own cascade — it was a
documented option that silently did nothing, and two doc comments described the
behavior it used to drive.
