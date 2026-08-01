---
"@weasel-js/core": patch
---

Clicks now land on the shape a node actually paints, not on its bounding box.
The pose rect is the wrong answer for anything that isn't a rectangle: a click
in a star's notch, in the corner outside an ellipse, or in the blank half of a
text box went to the node that merely bounds that point, burying whatever was
really underneath. `picking: 'shape'` had been available since it shipped and
was opt-in only because flipping it changes what a click selects.

Ink counts too, not just the boundary. A shape whose interior isn't filled —
an outlined rect, a pencil stroke, a bare line — is now grabbable along its
outline and not through its empty middle, which is the opposite of what a fill
test alone answers. Painters declare this through the new `NodeShapeEntry.ink`;
one that declares none is treated as filled, the previous behavior.

Pass `geometry={{ picking: 'pose' }}` to `SceneCanvas` for the old rect
behavior. Painters with no silhouette are unaffected either way, so nothing
becomes unreachable.
