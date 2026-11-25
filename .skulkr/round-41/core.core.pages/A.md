# Audit round 41 — area `core.core.pages`

## A zero-height or zero-width box is put on the earliest page it touches, not the one it overlaps most
- where: packages/core/src/core/pages/pages.ts:77 (overlap), :88 (pageOfBounds)
- scenario: pages `a` at x 0–100 and `b` at x 110–210 (gap 10), y 0–50. A horizontal line (a connector or a straight path, so its bounds have `height: 0`) from x 90 to x 200 at y 10. `overlap` returns `w * h`: 10 × 0 = 0 for `a` and 90 × 0 = 0 for `b`, so the tie goes to the earlier page and `pageOfBounds` answers `a`, with 10 units on it against 90 on `b`. The ruled rule (docs/unruled.md, 2026-10-13 pass 6) is "an object is on the page it overlaps most". The same tie decides `pageHolding`, `pageForBounds`, `placeOnPages` (an opened file's lines and connectors go on the wrong page, and then get clipped by that page's `pageClip`) and `groupingSite`. A degenerate box should be measured by the length it overlaps (fall back to the 1-D overlap when an area is 0) rather than by area.
- evidence: read
- severity: medium

## `createPageRun` on a scene that already has a page run makes a second run that every reader ignores
- where: packages/core/src/core/pages/pageNodes.ts:191 (createPageRun)
- scenario: `createPageRun(scene, [{ id: 'a', … }])`, then again with `[{ id: 'c', … }]` (for example two loaders, or a consumer calling it on a scene `loadScene` already gave a run). Nothing checks `pageRunOf(scene)` first, and the scene does not refuse a second root with `pageRun` (no guard in core/scene). The second call adds another run root with its own page nodes. `pageRunOf` returns the first root with `pageRun`, so `pagesOf`, `placedPagesOf`, `setPages`, `pageNodeOf`'s fallback, `pasteboardOn` and `placeOnPages` all see only the first run; page `c` draws and clips but is invisible to every page edit, export and lookup, and `setPages` never removes it. It should throw (as `addPage` throws on a used id), or hand off to `setPages`.
- evidence: read
- severity: medium

## core's `adoptLegacyPages` reads an unchecked `core:pages` value, so a bad save throws a `TypeError` or lays pages out at NaN
- where: packages/core/src/core/pages/legacyPages.ts:20 (adoptLegacyPages); packages/core/src/core/pages/pages.ts:52 (layoutPages, `ALIGN[align]`)
- scenario: a saved scene whose `doc['core:pages']` is `{}` or `{ pages: 'x' }`, loaded with `loadScene` and handed to the exported `adoptLegacyPages`: `setPages` → `requireDistinctPageIds` iterates `undefined` and throws a `TypeError`. The editor checks this value first (`checkPagesDoc` in packages/editor/src/snapshot.ts, ruled 2026-11-10: "the editor's `adoptSnapshotPages` [refuses] a `core:pages` value that is not a `PagesDoc`"), so the same question — is this value a PagesDoc — is answered in the editor and not in core's own adopter, which is the public entry point. Neither checks `layout`'s fields: `layout: { align: 'middle' }` (or `'toString'`, a prototype-chain hit on `ALIGN`) makes `ALIGN[align]` `undefined`/a function, so every page's cross-axis offset is `NaN`; `gap: "40"` (a string from JSON) turns `along += width + gap` into string concatenation and page `x` into `"010040…"`. The same unchecked fields reach `PAGE_RUN_LAYOUT.childPoses` from a loaded node's `pageRun` (statedFields copies it verbatim), so a saved run with a bad `align` lays its pages at NaN on every layout pass.
- evidence: read
- severity: low

## Files read
packages/core/src/core/pages/fitViewToPage.ts
packages/core/src/core/pages/legacyPages.ts
packages/core/src/core/pages/pageClip.ts
packages/core/src/core/pages/pageEdits.ts
packages/core/src/core/pages/pageNodes.ts
packages/core/src/core/pages/pagePlacement.ts
packages/core/src/core/pages/pageRunLayout.ts
packages/core/src/core/pages/pagedFixture.ts
packages/core/src/core/pages/pages.ts
packages/core/src/core/pages/pagesLayer.ts
packages/core/src/core/pages/placeOnPages.ts

<!-- done: 3 findings, files read: 11 -->
