# Audit round 60 — ui.components.part4

## A canceled pointer commits the range drag instead of canceling it
- where: packages/ui/src/components/InlineRange/useRangeEdit.ts:71 (onRelease, wired to `pointercancel` at :79 and :91)
- scenario: a touch drag on an `InlineRange` given `onValueInput`/`onValueChange`/`onValueCancel` is taken by the browser (a scroll or pinch starts, the pointer is lost) → `pointercancel` runs `onRelease`, which calls `commit()` and fires `onValueChange(last)` with the half-dragged value. `docs/conventions.md` ("Edit callbacks", Cancellation) lists "a canceled or lost pointer" as a cancel: it should send `onValueInput(from)` then `onValueCancel()` and no `onValueChange`. `lostpointercapture` is not listened for at all.
- evidence: read
- severity: medium

## `marks` with the default `fill` wipes out the track
- where: packages/ui/src/components/InlineRange/InlineRange.module.css:88 (`.range.marks`), with InlineRange.tsx:94
- scenario: `<InlineRange value={40} marks={[0.5]} />` (fill defaults to true) → the element gets `.range.filled.marks`. `.filled` paints the track as the element's `background` (via `--wzl-range-bg`) and sets `--wzl-range-track-bg: transparent`; `.range.marks` (higher specificity) then sets `background-image` to the mark layers alone, replacing the fill gradient. The result is no track and no fill, only the mark lines. Both props are public and the default combination is the broken one; the only in-tree caller (`Properties/NumberControls.tsx:177`) passes `fill={false}`, which is why it does not show.
- evidence: read
- severity: medium

## FpsMeter averages instantaneous rates, overstating frame rate on uneven frames
- where: packages/ui/src/components/FpsMeter/FpsMeter.tsx:27 and fpsAverage.ts:1 (rollingAverage)
- scenario: frames alternating 10 ms and 40 ms → samples 100 and 25, readout 63 fps; 2 frames in 50 ms is 40 fps. The arithmetic mean of `1000/delta` is biased toward the short frames, so a janky loop reads much better than it runs. The component claims a frame rate "averaged over the last 30 frames", which is `count·1000 / Σdelta` (average the deltas, not their reciprocals).
- evidence: read
- severity: low

## Input's adornments take no pointer events, so a control placed in one cannot be clicked
- where: packages/ui/src/components/Input/Input.module.css:17 (`.adornment { pointer-events: none }`), applied at Input.tsx:81 and :83
- scenario: `pointer-events` inherits, so every descendant of an adornment is click-through. TokenPanel puts a native `<input type="color">` in `leadingAdornment` (`TokenPanel/TokenControl.tsx:69-71`) and nothing gives it `pointer-events: auto` (`.swatchInput` in TokenPanel.module.css sets none) → clicking a color token's swatch does nothing; the picker opens only by keyboard. `InputProps` puts no limit on what an adornment may hold (a clear button, a unit select), so any interactive adornment is dead to the pointer.
- evidence: read
- severity: medium

## A mark that opens before a code span closes inside it, splitting the code span
- where: packages/ui/src/components/InlineMarkdown/parseInline.ts:15 (INLINE)
- scenario: the alternation is tried leftmost-first, so "precedence" only applies at one position. `parseInline('*the `**` operator*')` → the emphasis alternative at index 0 matches `*the \``, closing on the first `*` inside the backticks; the rest, "*` operator*", then matches emphasis again, so the result is em("the `"), em("` operator") (the code span is gone and its backticks show as text). Likewise `**see `a**b`**`. Inline markdown gives code spans priority over emphasis delimiters inside them; expected em("the ", code("**"), " operator").
- evidence: read
- severity: low

## A link whose URL contains parentheses is cut at the first `)`
- where: packages/ui/src/components/InlineMarkdown/parseInline.ts:15 (link alternative `\(([^)\s]+)\)`)
- scenario: `[Bézier curve](https://en.wikipedia.org/wiki/B%C3%A9zier_curve_(math))`-style hrefs, e.g. `[x](https://en.wikipedia.org/wiki/Foo_(bar))` → href `https://en.wikipedia.org/wiki/Foo_(bar` and a stray `)` rendered after the link. Markdown allows balanced parentheses in a link destination; the link goes to the wrong page.
- evidence: read
- severity: low

## Foundations' color table never re-reads its values, though its intro says the current side updates
- where: packages/ui/src/components/Foundations/Foundations.stories.tsx:322 (ThemedSwatch's layout effect, deps `[token]`) and :340 (intro text)
- scenario: the intro tells the reader to "drag the theme toggle and watch only the 'current' side update". Each swatch reads `getComputedStyle` once on mount and never again, so a theme, mode or density change in the workshop leaves every hex value as first read while the chips beside them (painted from `var(token)`) repaint — the printed values go stale against their own chips, and the described behavior never happens.
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

<!-- done: 7 findings, files read: 46 -->
