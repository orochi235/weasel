- Pathfinder read page-local geometry as world, so a boolean across pages came out wrong (A): fixed 17d1ea00f0. It needed 01f007866f first, a fix in core: `sceneNodeOutline` read text at its stored pose even though outlines are world space. That change narrows its parameter from any `{ get }` to a `Scene`, so its changeset is `major` with a before/after snippet. Draw's outlines adapter shares the world reads, so it now stores its results in the parent's frame as well.
- Layer chip sampled a gradient in RGB and ignored the paint's opacity (A): fixed fe3939d8ca. Solid and tile chips now fade by opacity too.
- An empty-text sticky note got a blank Layers row (B): fixed a173d689d3. A blank or whitespace-only label or text now falls back to the node id, and measurement rows get the same treatment.
- Turning machine-font outlines off left the 350 and 950 weight faces registered (B): fixed 18ee890152. It now unregisters what `listFontOutlines()` actually holds for each enrolled family.
- Copy loupe color stayed enabled and copied a stale hex after the loupe hid or the lens unmounted (B): fixed 759bc66ae0.
- Pathfinder's compareZ rebuilt and scanned the whole render order on every comparison (B): fixed 2b9199b136. The same code was in the kit's `booleansAdapter` dep in editing, and I fixed it there too. There is a new core export, `renderOrderCompare`: it ranks the cached `renderOrderNodes()` once per structural edit. I updated `exports.inventory.json` for it, and it has a changeset of its own.

No extra defects found beyond the ones above. I changed nothing in `docs/unruled.md`. The draw app gets no changesets because none exist for it in `.changeset/`. The core and editing changes have three: `scene-node-outline-world-pose`, `render-order-compare` and `booleans-compare-z-rank`.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - apps/draw/src/LayersPanel.test.tsx: pass (12)
  - apps/draw/src/booleansAdapter.test.ts: pass (10)
  - apps/draw/src/fonts.test.ts: pass (11)
  - apps/draw/src/outlinesAdapter.test.ts: pass (4)
  - apps/draw/src/surfaces/loupeAsset.test.tsx: pass (9)
  - packages/core/src/canvas/nodeOutline.test.ts: pass (8)
  - packages/core/src/core/scene/renderRank.test.ts: pass (2)
- The path-tools outline, knead, warp and shape-builder tests and editing's booleans and pathfinder tests, run against the `sceneNodeOutline` change: pass. The three editing tests (`deps/booleans.test.tsx`, `actions/pathfinder/action.test.ts`, `booleans.preview.test.ts`) also passed after the compareZ change.
- `npm run typecheck:packages -- core editing`: pass. Draw is an app with no package typecheck, so I ran root `npm run typecheck` for it: pass.
- eslint on every changed .ts/.tsx file: pass
- `npm run check:size`: pass
- `npm run check:changesets`: pass
- Unrun: none, since no `*.browser.test.*` file was touched.

The tree is clean.