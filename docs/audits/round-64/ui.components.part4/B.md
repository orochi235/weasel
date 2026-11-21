# Audit round 64 — ui.components.part4 — reviewer findings

## InlineRange's accent fill runs over the padding box, so its edge does not meet the thumb
- where: packages/ui/src/components/InlineRange/InlineRange.module.css:24 (`.range` background), :101 (`.range.filled.marks` origin), packages/ui/src/components/InlineRange/InlineRange.tsx:82 (`filled`)
- scenario: `.range` paints `--wzl-range-bg` (the `linear-gradient(... var(--slider-fill) ...)`) with the default `background-origin: padding-box`, clipped to the content box; `.filled.marks` restates `padding-box` for the fill layer. With the shipped tokens (slop 6px, thumb 8px) and a 150px track, the fill's edge sits at `f·(W+12) − 6` of the content box while the thumb's center sits at `4 + f·(W−8)` (the formula `marksStyle` itself uses). At value 10% the fill stops at 10.2px while the thumb's left edge is at 14.2px, leaving 4px of unfilled track between them; at 90% the fill runs 4px past the thumb's right edge. Up to 10px of disagreement at the ends. The fill should end under the thumb's center, the way the marks are placed.
- evidence: read (CSS and tokens.css values; arithmetic, not rendered)
- severity: low

## A held InlineRange is a controlled input with no change handler, so React warns on every mount
- where: packages/ui/src/components/InlineRange/InlineRange.tsx:41-49 (`REFUSED`), :80 (`rest`), :71 (`readOnly` taken off)
- scenario: `<InlineRange value={40} readOnly />`, or `disabled disabledReason="…"` (reachable, so `useNativeHold` sets `aria-disabled`, not `disabled`). `REFUSED` overwrites the `onChange: NOOP` that `named` installed with `undefined`, and `onInput` too, `readOnly` is destructured away and never reaches the `<input>`, and `disabled` is absent. React DOM's controlled-value check (`value` set, and no `onChange`, `onInput`, `readOnly` or `disabled`) then logs "You provided a `value` prop to a form field without an `onChange` handler" in development, once per mounted range: the `AcrossItsRange` story mounts five. Keeping `onChange: NOOP` in `REFUSED` (it is what the unheld path already does for the same reason) silences it without letting an edit through, since `useRangeEdit` refuses on its own listeners.
- evidence: read (React DOM's `checkControlledValueProps` from memory; not run)
- severity: low

## `***x***` parses as bold `*x` followed by a stray asterisk
- where: packages/ui/src/components/InlineMarkdown/parseInline.ts:24 (the strong alternative), :55 (`parseInline`)
- scenario: `parseInline('***important***')`. The strong alternative opens on the first `**` (the third `*` is a non-space, so it may follow), its lazy body takes `*important`, and it closes on the first `**` it meets, leaving the last `*` outside. The inner `*important` then has no closing `*` and stays literal. Result: `[{strong: [text '*important']}, text '*']`, drawn as **\*important**\*. It should be emphasis around strong (or strong around emphasis) of `important`, with no asterisk shown. Neither the code nor `docs/unruled.md` rules on a triple mark.
- evidence: read (traced the regex by hand; not run)
- severity: low

## The Lines foundation story lays its captions in a third cell of a two-column grid, so each one wraps under the token name
- where: packages/ui/src/components/Foundations/Foundations.stories.tsx:217-223 (`LinesView`), packages/ui/src/components/Foundations/Foundations.module.css:284-289 (`.borderRow`)
- scenario: `LinesView` reuses `.borderRow` (`grid-template-columns: 200px 1fr`) but puts three children in each row: the token, the sample rule, and the `lineCaption` span. Grid auto-placement puts the caption on an implicit second row, in the 200px first column, under the token name rather than beside its rule. `BordersView`, which the class was written for, has two children per row. The row needs a third column (or the caption a span) for the layout the story intends.
- evidence: read (not rendered)
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

<!-- done: 4 findings, files read: 46 -->
