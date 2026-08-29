---
'@weasel-js/core': patch
'@weasel-js/geom': patch
---

Close four gaps that produced wrong answers with no error

Three path walkers — `pathToMultiPolygon` in core and in `@weasel-js/geom`, and
`enumerateAnchors` behind the bezier-edit overlay — handled M/L/C/Q/Z with no
`default:` arm, so a command code they did not know fell out of the switch
without advancing the coordinate cursor and every segment after it read the
wrong floats. They now throw, matching the six sibling walkers. This is a
behavior change for anyone feeding these a path built with an opcode outside
`PATH_COMMANDS`: what used to come back subtly wrong now raises.

A `<CanvasView>` built its affordance hit-test without a device profile, so a
nested view resolved fine-pointer radii even under a coarse pointer — 8px grab
zones against the 14px chrome the surface paints. It reads the profile
`<SceneCanvas>` publishes.

`moveGestureAdapter`'s `insertNode` took no `index`, and the adapter carried
neither `getChildren` nor `setChildOrder`, so the sibling slot a delete op
records had nowhere to land: undoing a delete through the move pipeline
appended the node to the end of its parent instead of putting it back where it
was. All three are there now.

The dev inspector's gesture panel formatted bindings with a private formatter
that reported only modifiers set to `true`. The `ingest` action marks every
modifier `'optional'`, so its drop and paste bindings rendered blank and the
action was invisible on both gestures. Both of the panel's plain-text
formatters now go through the kit's `routesForSpec`.
