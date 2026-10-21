# Forge loupe: what is left

**The first version shipped (2026-10-21); this doc holds only the unbuilt half.** How the built
loupe works is in `packages/labkit/src/loupe/AGENTS.md` ("Lenses") and `packages/forge/README.md`
("Loupe"). For whoever extends weaselforge's loupe: what it still lacks, and what the first version
already decided for it.

## Glass as a user-facing aim

A lens's reticle has three aims: **Pinned** (a free node you drag, tied to the body by a leader
line), **Follow** (tracks the pointer) and **Glass** (sits at the body's center, so the lens shows
what it lies on). Pinned and Follow are built. Glass is built as ops and not as an action, so no
user can choose it.

Glass is the reticle's pose derived from the body, as an edge's path derives from the nodes it
joins: `setAimOps(scene, id, 'glass')` sets the reticle's `dependsOn`, dragging a Glass reticle
moves the body, and leaving Glass keeps the reticle where it was drawn
(`labkit/src/loupe/lens/lensScene.test.ts`). Switching Pinned to Glass was asked to be a few kit
calls with no new mechanism (2026-10-20), and it is. What is left is a `loupe.aim.glass` action and
its key in `lens/lensActionDefs.ts`.

## Later readouts

The first version's readouts are Token, Contrast and Pixel grid, with Difference as a view. Still
to build, each a toggle in the lens chrome and an action with a key:

- a box overlay: margin, border, padding, content, and distances to neighbors;
- baseline and density-grid guides;
- an element breadcrumb that jumps to the story or its source;
- freeze: hold the lens's image while args change.

## Revision and Reference sources

What a lens shows is a `LensSource`. Live and Pixels are built; `LensSourceKind` already reserves
`revision` (the story at another commit, such as `main` or the last one) and `reference` (a
baseline screenshot or a design export), and a lens falls back past a kind with no source.

Both render outside the page, as Pixels does, so they extend its capture path: the dev server's
capture endpoint (`packages/forge/src/vite/capture/`) and its payload. A Revision source needs a
second dev server or build at that commit to capture from; a Reference source needs somewhere the
images live and a way to name the one for a story. Neither is designed further than that.
Difference reads `sources.pixels` and the Pixel grid draws only for `kind === 'pixels'`
(`lens/LensSlot.tsx`, `lens/pixelGrid.ts`), so both need widening to any source that
`produces: 'pixels'` before they work over these.

## Holds from the first version

- **A re-render must not pass for proofing.** A view that redraws a story at 8× draws a half-pixel
  hairline crisp; every source says which one it is, and only a real rasterization is Pixels.
- **No loupe-specific drag, resize, select or undo code.** Lenses are scene nodes, moved by core's
  tools and ops.
- **A lens does not block the story.** A press that misses every lens reaches the story beneath.
