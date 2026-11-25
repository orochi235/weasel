# Audit round 70 — ui.testing

## `trigger(label)` matches any row whose label merely ends in `label`
- where: packages/ui/src/testing/selectRow.ts:7 (trigger)
- scenario: a panel has rows "Mode" and "Blend Mode". The regex `^(?!About )(?:.*\s)?Mode$` matches both "Fill Mode" and "Fill Blend Mode", because `.*\s` swallows "Fill Blend ". `getByRole` then throws "multiple elements", and when the "Mode" row is absent, `pick('Mode', …)` silently opens and changes "Blend Mode" instead. The pattern can't tell where the value ends and the label starts, so a label that is a word-suffix of another row's label is ambiguous.
- evidence: read
- severity: medium

## paramsText's `shown` and fontCascade's `shown` disagree on what counts as visually hidden
- where: packages/ui/src/testing/paramsText.ts:27 (shown) vs packages/ui/src/testing/fontCascade.tsx:105 (shown)
- scenario: both helpers ask "is this box clipped to a visually hidden 1px?". paramsText answers `width <= 1 || height <= 1` on every ancestor, with no overflow check. fontCascade answers `width <= 1 && height <= 1 && overflow !== 'visible'`. Take a row inside an ancestor with `height: 0; overflow: visible`, such as an absolutely positioned anchor or a collapsed wrapper whose children overflow it. `rowTexts` drops every label and value under it, so `mismatches`/`notAt` pass vacuously, while fontCascade still judges the same text. A thin rule-like ancestor (1px tall, full width) hides its whole subtree from rowTexts in the same way.
- evidence: read
- severity: medium

## `rowTexts` counts the row's own label text among its "other" values
- where: packages/ui/src/testing/paramsText.ts:50 (rowTexts)
- scenario: the walker runs over `row = label.parentElement`, which contains the label, so the label's own text node is pushed into `values`. That contradicts the `values` contract ("every other run of text"). `notAt(rows, '12px')` on a row whose label is at 11px reports the label twice: as `label X: 11px` and as `X → X: 11px`. A label that contains a nested span at a different size is reported as a value mismatch against itself.
- evidence: read
- severity: low

## `exportedComponents` skips components whose names start with two capitals
- where: packages/ui/src/testing/fontCascade.tsx:70 (exportedComponents)
- scenario: the filter `/^[A-Z][a-z]/` is meant to drop SCREAMING_CASE constants, but it also drops PascalCase components such as `XYPad`, `HSVPicker` or `A11yPanel` (forge already exports `A11yPanel`). Such a component never enters `components`, so the cascade suite never judges its elements as kit-made, and the "mounts every exported component" test never notices it is missing.
- evidence: read (forge `A11yPanel` found by grep; no ui component of that shape found today)
- severity: low

## The stale-`unmounted` check ignores entries for components that no longer exist
- where: packages/ui/src/testing/fontCascade.tsx:204 (describeFontCascade, "mounts every exported component")
- scenario: `stale` keeps only names with `components.has(name)`. When a component listed in `unmounted` is renamed or deleted, its entry and reason stay in the suite's table for good, and nothing fails. The check exists to keep that table honest.
- evidence: read
- severity: low

## `settle` waits on the host's markup only, not on the portals it then judges
- where: packages/ui/src/testing/fontCascade.tsx:169 (settle) / :192
- scenario: a story whose popover or toast portals into `document.body` and fills in after a lazy load. The host's innerHTML holds still, so `settle` returns after one or two waits, and the portal is read before its text arrives. Late text in a wrong face passes unseen. The portals are collected from `document.body.children`, but stability is never checked there.
- evidence: read
- severity: low

## `sweepAcross` releases with `buttons: 1` and a non-primary pointer
- where: packages/ui/src/testing/sweep.ts:15 (fireAt)
- scenario: every event, the `pointerup` included, carries `buttons: 1` unless `init` overrides it, and none sets `isPrimary`, which defaults to `false`. A real release reports `buttons: 0`, and the sibling fixture `packages/prefs-editor/src/PrefSchemaEditor/pointerDrag.fixture.ts:22` sends exactly that, with `isPrimary: true`, as does teardown's `poke`. A handler that reads release state from `buttons`, as routing's `pointerSession` does on moves (`move.buttons === 0`), or one that ignores non-primary pointers, sees a different gesture from the one a person makes. This is the same synthetic-press question answered differently in three places. (Inference: I found no handler today that misreads this particular pointerup.)
- evidence: read
- severity: low

## `readModuleCss` mis-wraps `supports()` conditions nested more than one level
- where: packages/ui/src/testing/readModuleCss.ts:11 (wrap)
- scenario: `@import './a.css' supports(selector(:has(a)));`. The supports group `(?:[^()]|\([^()]*\))*` allows only one level of parentheses, so it fails to match, and the whole condition falls into the media capture. The output is `@media supports(selector(:has(a))) { … }`, an invalid media query, so a test reading the assembled sheet sees the rules under the wrong condition (a browser would drop them).
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

<!-- done: 8 findings, files read: 15 -->
