Fixed all 13 findings across 12 commits on top of the frozen tree. Only shadow-root clipping was reported twice (A and B), so one commit covers both. The tree is clean, and the gate, labkit lint and every touched test file pass.

- `clipToAncestors` cut tiles to the scrolled root's box, or to the box of a body whose `overflow` went to the viewport (A): fixed 86a347690b → wait, see list below for exact shas

Exact lines:

- **Root/body clip uses the scrolled root's box instead of the viewport** (A): fixed e30139f4ec
- **Ancestor whose `overflow` applies to no box (`display: contents`, inline) collapses the tile** (A): fixed 8bf7b5f5d3
- **Paint containment (`contain: paint`/`content`/`strict`, `content-visibility`) is ignored** (A): fixed 619d603bd8
- **`clipToAncestors` stops at a shadow root** (A+B): fixed 86a347690b. The walk now follows slot and shadow host.
- **`scopeHolds` uses `Node.contains`, which does not cross shadow boundaries** (A): fixed 28b4171aa4
- **Document scroll listener outlives the surface without `containerRef(null)`** (A): fixed b989231a9f. It also survives a StrictMode remount, and the same cleanup covers the density watch.
- **`registerTile(id, null)` drops whichever element now holds the id** (A): fixed e314ced9ac. `registerTile` now returns a release bound to the element it placed, and overlay, lens and lent-top-buffer tiles release through it. This was my own call: it is recorded in `docs/unruled.md` and written as a `minor` changeset.
- **Swapping the container for one at the same place neither retiles nor repaints** (A): fixed 21f9e71746. This covers `TiledSurface`, and `LabSurface` now checks each canvas's own size instead of one remembered size.
- **Narrowing the scope to an element holding no tiles never clears the dropped tiles' pixels** (B): fixed d306dd9338
- **`useTileInScope` isn't told when a tile registers or unregisters under a scope** (B): fixed 34e65dcdd5
- **A painter that throws drops later painters and the after-commit callbacks** (B): fixed b5e3b6eeaa. Each one now runs isolated and logs with `console.error`, as the repo's emitters do.
- **dpr is read from the global window, not the container's window** (B): fixed f883d7bdbf. `watchDevicePixelRatio` in core takes an optional window (`api` changeset for `@weasel-js/core`).
- **Shadow-root clip** (B): duplicate of the A finding above, fixed in 86a347690b.

Extra defects found while fixing:

- **A registered clear that throws stopped the later clears and every painter** (sweep): fixed b5e3b6eeaa, together with the painter fix.
- **A slotted tile was walked through its light-DOM parent, not its slot** (sweep): fixed 86a347690b, together with the shadow-root fix.

Checks:

- `npm run checks:gate`: "checks:gate: all 32 passed"
- `npm run lint -w @weasel-js/labkit`: pass (exit 0)
- `npm run lint -w @weasel-js/core`: not run, because core has no `lint` script ("Missing script: "lint""). Core's changed file passed the gate's lint and typecheck.
- `npm run check:changesets`: "OK — 2550 changeset(s)"
- `npx vitest run --maxWorkers=1`, one file at a time, all pass:
  - `surface/clip.test.tsx` 11 passed
  - `surface/measureTiles.test.ts` 2 passed
  - `surface/tiledSurface.test.ts` 6 passed
  - `surface/useTiledSurface.test.tsx` 27 passed
  - `surface/useSurfaceTile.test.tsx` 8 passed
  - `lab/Lab.surface.test.tsx` 12 passed
  - `lab/Workspace.surface.test.tsx` 1 passed
  - `annotations/AnnotationOverlay.abandon.test.tsx` 2 passed
  - `annotations/Annotations.overlay.test.tsx` 12 passed
- Unrun browser tests that reach the changed code: `LentTopBuffer.browser.test.tsx`, `LensOverlay.browser.test.tsx`, `LabLightbox.browser.test.tsx`, `TrialLoupe.browser.test.tsx`, `AnnotationOverlay.clip.browser.test.tsx`, `Lab.density.browser.test.tsx`.

tally: 13 of 13 fixed, 2 extra fixed