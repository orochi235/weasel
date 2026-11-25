# Audit round 68 — ui.components.part4 (blind reviewer)

## useFloatingPlacement never measures a panel or container element that mounts or changes after the first commit
- where: packages/ui/src/components/FloatingPanel/useFloatingPlacement.ts:106-127 (useFloatingPlacement, measuring layout effect)
- scenario: the hook is public (exported from `FloatingPanel/index.ts`). A host renders the panel conditionally (`open && <div ref={panelRef}>`), or swaps the element `containerRef` points at. On the first commit `panelRef.current` is null, so the effect returns early. Its deps are only the ref objects, which never change, so it never runs again: no ResizeObserver is attached, `size`/`container` stay `{0,0}`, and the box is laid out against a 0×0 container (pinned at 0,0, drags clamped to nothing) for as long as the host stays mounted. A swapped container keeps being observed through the detached old element. It should re-measure when the elements change, for example a ref callback or effect deps on the elements.
- evidence: read (FloatingPanel itself always renders its element, so only direct hook callers hit this)
- severity: low

## InlineRange's fill and marks are drawn at `value` while the native thumb sits at the step-snapped value
- where: packages/ui/src/components/InlineRange/InlineRange.tsx:85-91 (InlineRange, `filled` / `fillAt`)
- scenario: `<InlineRange min={0} max={100} step={10} value={37} />`. The browser cleans the range's value up to the nearest step (40), so the thumb draws at 40%, but `filled` is computed from the raw 37, so the accent fill stops 3% short of the thumb's center. Whenever a host passes a value off the step grid (a value computed elsewhere, a mixed selection's average), the fill and the thumb disagree. The fill should use the step-snapped value the element shows, not the raw prop.
- evidence: read (sanitization per the HTML range value algorithm; not run)
- severity: low

## A `<kbd>` shortcut whose key is `<` never parses as keys
- where: packages/ui/src/components/InlineMarkdown/inlineScan.ts:83-86 (InlineScan.matchAt, `'<'` case)
- scenario: `parseInline('Zoom out: <kbd>Mod+<</kbd>')`. `matchAt` takes the first `<` after `<kbd>` as the start of the closer. That is the key's own `<`, followed by `<` rather than `</kbd>`, so the match fails and the line renders the literal text `<kbd>Mod+<</kbd>`. A backslash can't rescue it either: the body would come through as `Mod+\<`, because `keys` bodies are not unescaped. It should search for `</kbd>` itself (`indexOf('</kbd>', p + 5)`).
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
packages/ui/src/components/InlineMarkdown/inlineScan.ts
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

<!-- done: 3 findings, files read: 46 -->
