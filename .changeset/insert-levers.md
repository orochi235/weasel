---
"@weasel-js/core": patch
---

Drawing a polygon or a star leaves the last-operation panel up with its sides, or its points and inner radius
(`insertParams`, `POLYGON_INSERT_PARAMS`, `STAR_INSERT_PARAMS`); a change redraws the shape in place from the same
drag, as one undo entry. A drag that insert behaviors answered gets no panel. The star's "Inner" property row is now
"Inner radius". The scene's history answers `activeJournal()`, and its journals `observe`, so the last operation
follows edits into an open journal, such as path edit's.
