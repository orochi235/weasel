---
"@weasel-js/geom": patch
"@weasel-js/ui": patch
"@weasel-js/text": patch
"@weasel-js/text-dom": patch
"@weasel-js/core": patch
"@weasel-js/path-tools": patch
---

Text can follow a path. `@weasel-js/geom` adds a `'path'` track shape (`pathShape`), a `side` override on `trackRun`,
and `placeAlongRun`, which turns item lengths into places along a run, in `RunOrder` `'reading'` or `'track'`.
`TrackShape` gains a required `closed` member, so a shape implemented outside geom has to add it.
`runPlaces` and `runLength` moved there from `@weasel-js/ui`, which re-exports `runPlaces` by name, so its curved rows
come from geom's placement. `measurePath` takes `keepCorners`. `@weasel-js/text` adds `textClusters`, a line's
grapheme clusters as outlines with their advances. `@weasel-js/core` adds the `textAlong` path effect; every effect
takes `hideSources`, effect sources can carry a list of items, curved text is derived again when a font loads, a
hidden source is edited through its effect, and Delete, Cut and Expand now remove an effect's hidden sources with
it. A committed in-place text edit is labeled "Edit text" in history.
`@weasel-js/path-tools` adds Text Along Path (Alt+Shift+X), Release and Set Path. `useTextEdit` in
`@weasel-js/text-dom` gains `onDraft`.
