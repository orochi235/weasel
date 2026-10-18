---
'@weasel-js/geom': patch
'@weasel-js/path-tools': patch
---

A path constraint conflict names every constraint it needs, not only the one left failing. Fixing both ends of an edge and then asking for it vertical reports all three, so the fix — drop either pin, or the new constraint — is on screen.

`@weasel-js/geom` gains `conflictingConstraints(points, constraints, opts?)`: for each group of constraints sharing anchors that cannot all hold, a smallest subset that still cannot, found by dropping each member in turn and keeping it out when the rest still fail. Later constraints in the list are kept over earlier ones that conflict the same way, so the one just added stays in the set. A constraint that cannot apply at all is named on its own.

In `@weasel-js/path-tools`, `constraintConflictsOf` and the overlay's conflict color cover the whole set, and `setConstraints` answers it — empty when every constraint holds, null when the dep cannot store — where it answered a boolean. This changes `setConstraints`' return type.
