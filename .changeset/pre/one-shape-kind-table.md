---
'@weasel-js/core': patch
---

Dragging out a text box shows a live preview

The set of insertable kinds and the `KitInsertShape` union sat on adjacent
lines with no linkage, and seven more sites restated one list or the other. The
drift was already live: the text tool binds `actionId: 'insert'` and commits
through the insert dep, but the runtime set never listed `text`, so a
drag-to-insert text box had no preview.

`SHAPE_KINDS` is now one descriptor table — a row per kind, flagged for whether
it has a built-in tool and whether it takes an insert preview. Both unions,
`KIT_SHAPE_KINDS`, `BUNDLE_TOOLS.exhaustive`, the known-builtin-id list and the
preview gate all derive from it.

Two type-surface consequences. `KIT_SHAPE_KINDS` is typed
`readonly BuiltinShapeToolId[]` rather than a literal tuple — same contents,
same order, and `(typeof KIT_SHAPE_KINDS)[number]` is unchanged; what goes is
positional and length typing, which nothing uses. And `OngoingOverlay['shape']`
gains `'text'`, which is the fix itself: a consumer switching exhaustively over
it gains a case, handled by the existing box arm.
