- SceneNode schema empty because the node types now sit in `nodeTypes.ts` and `types.ts` only re-exports them (A+B): fixed e618f37f1d
- Inspector's op catalog reads a fixed seven files and misses most of core's op factories (A): fixed ad5c54a601
- An args type written as a type alias always gives an empty params list (A): fixed fdfb7e7dd2. Latent, since no op used an alias. extract-node's duplicate member reader now goes through the same shared helper.
- Action catalog shows only undo and redo, missing `defineAction`/factory actions and editing's actions (A+B): fixed 0984a1c306. It now lists 60. Actions whose id is computed from a factory argument (`makeAlignAction('left')`, nudge, pathfinder) still appear under their export name, because their id isn't in the source as a literal.
- Gesture catalog has a nonexistent `pointerdown` kind and lacks six real ones; the hand-written `drag` payload was wrong (A+B): fixed 9d799b05eb. Each entry is now built from the `GestureSpec` union and lists that kind's spec fields. The inspector's `GESTURE_CATALOG_KEYS` is checked against the union by `satisfies Record<GestureSpec['kind'], true>`.
- Shape extractor walks `makeLeaf`, which is gone, so every shape came out empty, polygon/star listed a callback as data, and lasso appeared as a shape (A+B): fixed 0b7c6d67fc. It now reads `KIT_INSERT_KINDS` and the node each `case '<kind>':` in editing's `deps/insert.ts` builds. pen and lasso now correctly show no schema.
- `watchedFilesFor` lists two deleted files and misses the files the extractors read (A+B): fixed 2946709770. The list is now built from each extractor's own exported source constants and matches directories. It also refreshes on files added or removed, not only changed. A test checks that every schema's source file is watched.
- Callback-source plugin misses editing's and routing's tools and actions; the prefix test lets `tools` match `toolsX` (A+B): fixed 557d5e5bad. Tools and actions live in more than a dozen packages, so it now includes every package's `src`, and it matches by directory.
- `draw:rotation`'s arrowhead points down while the arc arrives moving right (A+B): fixed 27b1cbad75. Rendered old against new: wall: http://orochi.local:8787/to/weasel-skulk-f1/8b051f93-f774-47cb-8d40-2bdea9abe45b.png
- 16 of draw's glyphs are named nowhere, four of them duplicating core's text-styling glyphs (A): fixed 2b00c07b3c. This is my call, recorded in `docs/unruled.md` under "draw". The 16 are deleted, and a test fails on any draw glyph draw's source doesn't name. I fixed rotation in the commit before, so reverting the deletion brings back a correct glyph.

Extra defects found while fixing: none beyond the ones folded into the commits above (the add/unlink watcher events, and the duplicate member reader).

No changesets: every change is in `apps/draw` and `docs`, which ship no package.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: `apps/draw/vite-plugin-trait-schemas/extract.test.ts` pass (9), `apps/draw/vite-plugin-callback-source.test.ts` pass (2), `apps/draw/icons/actions.test.ts` pass (1), `apps/draw/src/dev/RegistryDetail.test.tsx` pass (16), `apps/draw/src/dev/RegistryInspector.test.tsx` pass (4), `apps/draw/src/dev/registryData.test.tsx` pass (16)
- `npm run typecheck` pass. `typecheck:packages` was not run because no package changed. Commit 27b1cbad75 on its own fails typecheck on an untyped `.mjs` import in its test; 2b00c07b3c rewrites that test, so HEAD passes.
- eslint `--max-warnings=0` on every changed file: pass
- `npm run check:size`: pass
- `npm run check:changesets`: pass
- Tree is clean.