# Audit round 70 — ui.testing

## `settle` returns after one wait when a story's first markup is empty, so a lazy-loaded story is judged before it renders
- where: packages/ui/src/testing/fontCascade.tsx:170 (settle)
- scenario: a story whose first commit puts nothing in the host, such as a `React.lazy` component under `<Suspense fallback={null}>` or an effect that mounts content on its next tick. `last` starts as `''`, so after the first 50 ms wait `host.innerHTML === last` is true and `settle` returns. `strays` then walks an empty host and passes without checking anything, and `mountedTypes` misses the components it would have mounted. The doc says settle waits for "a lazy load"; it should require at least two reads that agree (start `last` at a value innerHTML can never hold, e.g. `null`).
- evidence: read
- severity: medium

## The two "visually hidden" predicates disagree; paramsText's skips any row under a zero-width or zero-height ancestor
- where: packages/ui/src/testing/paramsText.ts:27 (shown), compared with packages/ui/src/testing/fontCascade.tsx:105 (shown)
- scenario: fontCascade treats an ancestor as hiding its content only when it is ≤1px in **both** dimensions **and** clips (`overflow !== 'visible'`). paramsText treats an ancestor as hiding its content when it is ≤1px in **either** dimension, whatever its overflow. So a label or value inside a zero-height wrapper with overflow visible (for example, a wrapper around absolutely positioned content, or a collapsed flex item that overflows visibly) is shown on screen but skipped by `rowTexts`. `mismatches` and `notAt` then pass without checking it. The same question ("can a reader see this?") gets two different answers in two places.
- evidence: read
- severity: low

## `trigger(label)` matches every row whose label ends in the same words, so `pick('Mode', …)` throws when a "Blend Mode" row is also on the page
- where: packages/ui/src/testing/selectRow.ts:7 (trigger)
- scenario: the pattern `^(?!About )(?:.*\s)?Mode$` matches "Fill Mode" and also "Normal Blend Mode", because the value prefix `.*\s` can swallow any leading words of a longer label. With rows labeled "Mode" and "Blend Mode" on one panel, `getByRole` finds several matches and throws, even though "Mode" names exactly one row.
- evidence: read (inferred from the regex; not run)
- severity: low

## `sweepAcross` releases with `buttons: 1`, which a real pointerup never reports
- where: packages/ui/src/testing/sweep.ts:28 (sweepAcross / fireAt)
- scenario: `fireAt` defaults `buttons: 1` for every event, including the final `pointerup`. A browser reports `buttons: 0` on the pointerup that releases the only button, and teardown.tsx's `poke` sends `buttons: 0`. A handler that reads `e.buttons` at release time to decide whether the drag ended (or whether a chorded button is still held) sees a button still down, so the sweep's end is tested against an input no user can produce.
- evidence: read
- severity: low

## `readModuleCss` inlines a sheet once per import path, where the bundler inlines it once
- where: packages/ui/src/testing/readModuleCss.ts:25 (readModuleCss)
- scenario: A imports B and C, and both of them import D. Only the importer chain is tracked (for cycle detection), so D's rules appear twice: once after B's position and again after C's. postcss-import, which Vite uses, skips duplicates by default, so the bundled sheet holds D once. A test that reads rules off this text (counts matches, or takes the last declaration as the one that wins) sees D's rules again after C, overriding C rules the real bundle lets win. The doc says the function returns the stylesheet "as the bundler assembles it", which is not true here.
- evidence: read (postcss-import's `skipDuplicates` default is recalled, not checked in this tree)
- severity: low

## `readModuleCss` misreads a `supports()` condition nested two parentheses deep as a media query
- where: packages/ui/src/testing/readModuleCss.ts:11 (wrap)
- scenario: `@import './x.css' supports(selector(:has(a)));`. The supports group `(?:[^()]|\([^()]*\))*` allows only one level of nested parentheses, so it fails to match, and the whole text falls into the media group. The output is `@media supports(selector(:has(a))) { … }`, an invalid media query that drops the sheet's rules; it should be `@supports selector(:has(a)) { … }`.
- evidence: read
- severity: low

## The unmounted-list staleness check never flags an entry whose component no longer exists
- where: packages/ui/src/testing/fontCascade.tsx:204 (describeFontCascade, "mounts every exported component")
- scenario: `stale` keeps only names for which `components.has(name)`. After `BarSpacer` is removed or renamed, its `unmounted` entry stays in the test file forever with a reason that is no longer true, and nothing fails. An entry that names no exported component is stale for the same reason as one a case mounts.
- evidence: read
- severity: low

## Files read
packages/ui/src/testing/badge.ts
packages/ui/src/testing/composeStory.tsx
packages/ui/src/testing/contextMenu.ts
packages/ui/src/testing/fontCascade.tsx
packages/ui/src/testing/geometry.ts
packages/ui/src/testing/icon.ts
packages/ui/src/testing/labViews.ts
packages/ui/src/testing/paintedContrast.ts
packages/ui/src/testing/paramsText.ts
packages/ui/src/testing/prefs.ts
packages/ui/src/testing/readModuleCss.ts
packages/ui/src/testing/selectRow.ts
packages/ui/src/testing/sweep.ts
packages/ui/src/testing/teardown.tsx
packages/ui/src/testing/withIcons.tsx

<!-- done: 7 findings, files read: 15 -->
