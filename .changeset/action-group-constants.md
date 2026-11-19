---
'@weasel-js/core': minor
'@weasel-js/editing': minor
'@weasel-js/routing': minor
---

The kit's action groups are named constants, for `<ActionBar group>` and anything else that gathers actions by group

Core exports `HISTORY_GROUP`, `VIEWPORT_GROUP` and `PRESENTATION_GROUP` beside its `ANCHORS_GROUP` and `PATH_GROUP`, and re-exports routing's new `TOOL_GROUP`. Editing exports `CLIPBOARD_GROUP`, `EDIT_GROUP`, `STRUCTURE_GROUP`, `NUDGE_GROUP`, `INSERT_GROUP`, `ALIGN_GROUP`, `DISTRIBUTE_GROUP`, `FLIP_GROUP`, `REORDER_GROUP` and `PATHFINDER_GROUP`. Each is the string its actions already carried, so `<ActionBar group="history" />` still works; `<ActionBar group={HISTORY_GROUP} />` says where it comes from.

<!-- entry: api -->
