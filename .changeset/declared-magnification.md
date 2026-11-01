---
"@weasel-js/quantity": patch
"@weasel-js/core": patch
"@weasel-js/guides": patch
"@weasel-js/ui": patch
---

A unit scope can declare the magnification its frame is drawn at: `units: { system, drawnAt: 0.4 }` on a node
whose scale `transform` draws its children at 0.4×. The declaration draws nothing; it says what the transform is
meant to be, so lengths read on screen can be divided back to the size they were modeled at.

- `magnificationOf(scopes)` (quantity) multiplies the chain's `drawnAt`; `sceneMagnification(scene, ids)` and
  `sceneDeclaredScopes(scene, id)` (core) read it off a scene.
- Equal-spacing snap marks and `distanceReadout` divide their lengths by the declared magnification of the nodes
  they measure.
- `undeclaredMagnifications(scene)` (core) lists every container under a declared scope whose children are drawn
  at a size its scopes do not declare, and `SceneCanvas` warns once per container in development: a container
  drawn at 1.5× with nothing declaring it is what turns a 20″ cabinet into 30″ of board.
- `scaleBar` (quantity) picks a round length for a frame's scopes, and `<ScaleBar>` (ui) draws it, labeled in the
  frame's own units and saying what size the frame is drawn at.
