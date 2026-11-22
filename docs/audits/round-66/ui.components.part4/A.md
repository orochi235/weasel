# Audit round 66 — ui.components.part4

## A drag that starts from a corner-snapped placement shows the box offset from the pointer by up to the snap threshold
- where: packages/ui/src/components/FloatingPanel/useFloatingPlacement.ts:168 (useFloatingPlacement, startDrag onMove) via packages/ui/src/components/FloatingPanel/dragPlacement.ts:25 (dragPlacement)
- scenario: drop the panel 10px short of the top-left corner on each axis. windease's reduce snaps it and returns `{ x: D.x, y: D.y, anchor: 'top-left' }` (the drop point, not the corner origin); the host commits that, and the box renders at the corner origin O = (inset, inset). Press the box and drag. Every move calls `dragPlacement(over, totalDx, totalDy)`. windease treats an anchored place whose x/y are within the threshold of its corner as "not stale", so it uses the stored drop point D as the base, not O, where the box is shown. Once the box leaves the corner it sits at D + delta while the pointer has moved delta from O, so it trails the pointer by (D − O), up to 12px on each axis, for the whole drag. That contradicts the hook's own doc: "a corner it passed or an edge it was held against does not offset it from the pointer". It should base the whole-travel drag on where the box is shown, e.g. by re-basing `over` to its resolved origin at press. windease's base-on-x/y rule was written for incremental per-event deltas, and this hook feeds it whole-travel deltas.
- evidence: read (node_modules/windease/dist/layout/floating.js reduce: `stale`/`base`, lines 294–302)
- severity: medium

## `<kbd>` is a mark that a backslash cannot keep literal
- where: packages/ui/src/components/InlineMarkdown/parseInline.ts:30 (INLINE, escape alternative)
- scenario: `parseInline('write \\<kbd>Mod+Z</kbd> to show a shortcut')`. The escape alternative only takes `` ` * ~ [ ] \ ``, so `\<` is not an escape. The output is the text `write \`, then a `keys` token, then the rest, and InlineMarkdown draws a KeySequence with a stray backslash in front of it. The docstring says "with a backslash keeping a mark literal", and `<kbd>…</kbd>` is one of the marks it lists. Expected: `\<` reads as a literal `<`, and the `<kbd>` text stays as written.
- evidence: read
- severity: low

## An empty ItemList drops the hold's reason and puts the list's `aria-label` on a roleless div
- where: packages/ui/src/components/ItemList/ItemList.tsx:154 (ItemList, empty branch)
- scenario: `<ItemList rows={[]} disabled disabledReason="Select a layer first" containerProps={{ 'aria-label': 'Layers' }} />`. The empty branch returns early without `hold.wrap(hold.scope(…))`, so the reason is never rendered or described and the hold scope is not provided. That path silently drops `disabledReason`/`readOnlyReason`. The same branch spreads `containerProps` onto a `div` with no role, and `aria-label` is prohibited on a generic element, so HistoryList's `'History'` name is not exposed while the list is empty. Expected: the empty state goes through the same wrap/scope, with a role (or no name), like the populated branch.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/FloatingPanel/dragPlacement.ts
packages/ui/src/components/FloatingPanel/index.ts
packages/ui/src/components/FloatingPanel/useFloatingPlacement.ts
packages/ui/src/components/FontOptions/fontOptions.ts
packages/ui/src/components/FontOptions/index.ts
packages/ui/src/components/Foundations/Foundations.module.css
packages/ui/src/components/Foundations/Foundations.stories.tsx
packages/ui/src/components/FpsMeter/FpsMeter.module.css
packages/ui/src/components/FpsMeter/FpsMeter.stories.tsx
packages/ui/src/components/FpsMeter/FpsMeter.tsx
packages/ui/src/components/FpsMeter/fpsAverage.ts
packages/ui/src/components/FpsMeter/index.ts
packages/ui/src/components/HistoryList/HistoryList.module.css
packages/ui/src/components/HistoryList/HistoryList.stories.tsx
packages/ui/src/components/HistoryList/HistoryList.tsx
packages/ui/src/components/HistoryList/index.ts
packages/ui/src/components/Icon/Icon.gallery.stories.module.css
packages/ui/src/components/Icon/Icon.gallery.stories.tsx
packages/ui/src/components/Icon/Icon.tsx
packages/ui/src/components/Icon/actionIcon.ts
packages/ui/src/components/Icon/iconFromData.ts
packages/ui/src/components/Icon/index.ts
packages/ui/src/components/Icon/layers.ts
packages/ui/src/components/Icon/placeholder.ts
packages/ui/src/components/Icon/resolveIcon.tsx
packages/ui/src/components/InlineMarkdown/InlineMarkdown.stories.tsx
packages/ui/src/components/InlineMarkdown/InlineMarkdown.tsx
packages/ui/src/components/InlineMarkdown/index.ts
packages/ui/src/components/InlineMarkdown/parseInline.ts
packages/ui/src/components/InlineRange/InlineRange.module.css
packages/ui/src/components/InlineRange/InlineRange.stories.module.css
packages/ui/src/components/InlineRange/InlineRange.stories.tsx
packages/ui/src/components/InlineRange/InlineRange.tsx
packages/ui/src/components/InlineRange/index.ts
packages/ui/src/components/InlineRange/useRangeEdit.ts
packages/ui/src/components/Input/Input.module.css
packages/ui/src/components/Input/Input.stories.module.css
packages/ui/src/components/Input/Input.stories.tsx
packages/ui/src/components/Input/Input.tsx
packages/ui/src/components/Input/index.ts
packages/ui/src/components/ItemList/ItemList.module.css
packages/ui/src/components/ItemList/ItemList.stories.module.css
packages/ui/src/components/ItemList/ItemList.stories.tsx
packages/ui/src/components/ItemList/ItemList.tsx
packages/ui/src/components/ItemList/domItemList.tsx
packages/ui/src/components/ItemList/index.ts

<!-- done: 3 findings, files read: 46 -->
