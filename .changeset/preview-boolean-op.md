---
'@weasel-js/core': patch
---

`previewBooleanOp(adapter, op, opts)` answers what `applyBooleanOp` would make of the selection, each piece with the source it stands in for and the paint a counted stroke leaves it, without minting a node or committing anything. It is what a live preview of a Pathfinder operation draws from. New API: `previewBooleanOp`, `BooleanOpPreview`, and `BooleanPreviewPiece`. The two functions share one resolution, so a preview and the commit that follows cannot disagree.
