I couldn't save `.skulk/out/findings.md` because the write was denied, so the whole findings document is below instead.

# Findings: core.core.pages (round 41)

## pageOfBounds ranks pages by overlap area, so a zero-thickness box goes to the earliest page it touches, not the one it mostly lies on
- where: packages/core/src/core/pages/pages.ts:77 (overlap), :88 (pageOfBounds)
- scenario: pages `a` at x 0–100 and `b` at x 110–210 (row, gap 10, height 50). A horizontal line has bounds `{ x: 50, y: 20, width: 150, height: 0 }`, so 50 units of it lie on `a` and 90 on `b`. `overlap` gives `50 × 0 = 0` for `a` and `90 × 0 = 0` for `b`, and the tie goes to the earlier page. So `pageOfBounds` puts the line on `a`, and so do `pageHolding`, `pageForBounds`, `placeOnPages` and `groupingSite`. A vertical line in a column run has the same problem. It should go on `b`, the page holding most of it.
- evidence: read
- severity: medium

## createPageRun on a scene that already has a page run adds a second run that every page reader ignores
- where: packages/core/src/core/pages/pageNodes.ts:191 (createPageRun)
- scenario: the exported `createPageRun` is called on a scene that is already paged, for example by a "make paged" command that doesn't check `isPaged` first. It adds a second root with a `pageRun` field, plus its page nodes. Neither `createPageRun` nor the scene stops this. `pageRunOf` returns the first such root, so `pagesOf`, `placedPagesOf`, `pageNodeOf`'s search, the page edits and `placeOnPages` only ever see the first run. The second run's pages still draw and clip, but `setPages` and `removePage` can't reach them. It should throw or return the existing run.
- evidence: read
- severity: medium

## adoptLegacyPages throws a TypeError on a `core:pages` value that is not a PagesDoc
- where: packages/core/src/core/pages/legacyPages.ts:20 (adoptLegacyPages)
- scenario: a save's `core:pages` value is `{}` or `{ pages: 3 }`. Core's exported `adoptLegacyPages` casts it without checking and passes it to `setPages`. There `requireDistinctPageIds` iterates `next.pages` and throws `TypeError: … is not iterable`, and the value stays in the document. docs/unruled.md (2026-11-10) rules that the editor's `adoptSnapshotPages` refuses such a value with a named error. Core's own public entry for the same conversion still fails with the raw TypeError.
- evidence: read
- severity: low

## layoutPages looks `align` up in a plain object literal, so an unknown or prototype-named value gives NaN poses
- where: packages/core/src/core/pages/pages.ts:52 (layoutPages)
- scenario: a loaded scene's `pageRun` is `{ align: 'middle' }` or `{ align: 'toString' }`. `PAGE_RUN_LAYOUT.childPoses` spreads `pageRun` into `layoutPages`. `ALIGN['middle']` is `undefined`, and `ALIGN['toString']` is an inherited function, so `offset` is `NaN`. Every page's cross-axis coordinate becomes `NaN`: the pages vanish and `pageOfBounds` finds none. It should fall back to `'start'` or refuse the value, using an own-property lookup.
- evidence: read (I didn't trace whether loading a save validates `pageRun`)
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

<!-- done: 4 findings, files read: 11 -->