---
'@weasel-js/core': patch
'@weasel-js/geom': patch
---

Path command opcodes derive from one table

`M`/`L`/`C`/`Q`/`Z` and their coordinate counts were declared five times —
once in core, once in `@weasel-js/geom`, and three more as `COORD_COUNT`
literals in the path transform, pose-rotation and pose-descriptor walkers. They
agreed, and nothing held them to each other: a sixth opcode desynchronizes two
packages' reading of the same `Uint8Array` with no exception and no type error,
and every walker misparses the coordinate stream from that command on.

`PATH_COMMANDS` in `@weasel-js/geom` is now the table. `PATH_M`…`PATH_Z`,
`PATH_CMD_LENGTHS` and the new `pathCommandCoordCount` all derive from it, and
core re-exports them by name, so the opcode constants keep their names, values
and literal types. The three walkers moved onto `forEachSegment` rather than
onto the accessor alone — they were duplicating the coordinate-cursor advance
as well as the length, and the cursor is the half that actually misreads.

Eight further files switch on these opcodes with inline literals. Five throw on
an unknown code; three — the path boolean adapter, the anchor-editing geometry,
and geom's own boolean adapter — have no `default` arm and would silently stop
advancing. Left as-is; they need per-command semantics, not one walker.
