---
'@weasel-js/diagram': patch
---

`SEQUENCE_TOOLS` gains Mark, which clicks an activation's start or end, a creation, or a destruction onto the lifeline
nearest the click, at the row nearest it (`createAddMarkAction`; the host picks the kind through the `mark` reader).
`sequenceSelectionOf` reads a selection as one sequence's selected participants, messages, notes, fragments, and
boxes, falling back to the scene's only sequence, so a panel can offer the edits that fit. `commitSequence` keeps a
selected part selected through the rebuild, where it used to drop the selection.
