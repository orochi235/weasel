---
'@weasel-js/guides': patch
'@weasel-js/ui': patch
'@weasel-js/quantity': patch
---

Rulers along the top and left of a 2D canvas. `createRulers` (guides) returns a contribution for `<SceneCanvas ambient>` that follows the view and the pointer, claims presses on the ruler strips, and turns a drag off a ruler into a guide, a drag on a guide into a move, and a drop back on a ruler into a removal, each one undo step through `addGuideOp`, `replaceGuideOp`, and `removeGuideOp`. `<Rulers>` (ui) draws them, and `rulers.settled` leaves the guide being moved out of a guides layer while the rulers draw it where it is going. The labeled step is the one `scaleBar` picks, and the labels read in the unit scopes of the frame under the pointer, falling back to the document's, so inside a frame declaring `drawnAt` they read its true lengths. The rulers' look is provisional: theme tokens only, to be settled.

Alongside: `useGuides()` gains `subscribe`, which `createGuidesLayer` takes so a canvas repaints when a guide comes or goes; `guideSnapSource` offers nothing for a guide whose id the gesture excludes; and `scaleBar` now says which `unit` its label is written in.
