# Audit round 60 — ui.components.part4

## fontFamilyOptions leaves out outline-tier families and labels a painting one "not loaded"
- where: packages/ui/src/components/FontOptions/fontOptions.ts:46 (fontFamilyOptions)
- scenario: a host registers a family only through the outline tier (font bytes, no atlas, no canvas enrollment). `resolveFontVariant` serves it with `source: 'outline'` (packages/font/src/resolveFontVariant.ts:46), and `fontWeightOptions` offers its real weights, since `listFontWeights` reads `listFontOutlines()`. But `fontFamilyOptions` builds its list from `listAtlasFonts()` and `listCanvasFonts()` only, so the family is missing from the picker. When it is the current value it gets pushed as an extra entry labeled "<family> — not loaded", though it is loaded and painting in its own face. The two option builders disagree on which tiers count, and the label reports something false.
- evidence: read
- severity: medium

## FpsMeter averages per-frame rates, which overstates the frame rate when frame times vary
- where: packages/ui/src/components/FpsMeter/FpsMeter.tsx:27 (FpsMeter loop) / fpsAverage.ts:1 (rollingAverage)
- scenario: each frame pushes `1000 / delta`, and the readout is the arithmetic mean of those rates. With frames alternating 10 ms and 90 ms (2 frames per 100 ms = 20 fps), it shows round((100 + 11.1) / 2) = 56. One long hitch among fast frames hardly moves the number. The frame rate over the window is samples / sum(deltas), the harmonic mean of the rates. The component promises "a live frame-rate readout, averaged over the last 30 frames" but under jank it reports a rate the screen never reached.
- evidence: read
- severity: low

## InlineRange with `marks` and the default `fill` loses its whole track, and the fill with it
- where: packages/ui/src/components/InlineRange/InlineRange.module.css:88 (`.range.marks`), with `.filled` at :98
- scenario: `<InlineRange value={40} marks={[0.5]} />`, so `fill` is left at its default `true`. `.filled` paints the track and the fill as the element's own background (`--wzl-range-bg`, which `.range` applies through the `background` shorthand), and makes the track pseudo-element transparent (`--wzl-range-track-bg: transparent`). `.range.marks` (specificity 0,2,0) then sets `background-image` to the mark layers, which replaces the fill gradient. What draws is the thumb and the 1px marks on an empty box: no track, no accent fill. The marks should sit on top of the filled track; the gradient needs to be composed into the same `background-image` list. The one in-tree consumer (`Properties/NumberControls.tsx:177`) passes `fill={false}`, which is why nothing shows the bug yet.
- evidence: read
- severity: medium

## useFloatingPlacement keeps its own list of controls, narrower than gestures' CONTROL_SELECTOR, so dragging in a contenteditable moves the panel
- where: packages/ui/src/components/FloatingPanel/useFloatingPlacement.ts:67 (isInteractive)
- scenario: the panel decides "this press is the child's" from `input, button, a, select, textarea, [data-no-drag]`. `@weasel-js/gestures`' `CONTROL_SELECTOR` (packages/gestures/src/ui/controlTarget.ts:2), which ItemList and the dispatcher use for the same question, also counts `[contenteditable]`, `summary`, and `[role=button|checkbox|switch|radio|link|menuitem*|tab|option]`. In a FloatingPanel holding a contenteditable text box, a press-drag to select text crosses the threshold, captures the pointer and moves the panel; the selection never happens. A `role="switch"` or `role="tab"` control drags the panel the same way. The question is answered two ways in two places.
- evidence: read
- severity: low

## parseInline makes emphasis out of two globs on one line when the second `*` follows a non-space
- where: packages/ui/src/components/InlineMarkdown/parseInline.ts:15 (INLINE, the `*…*` alternative)
- scenario: the comment promises "a glob's `*.ts` stays as written", and only checks that the closing `*` follows a non-space. `Copies src/*.ts to lib/*.js` parses as `Copies src/`, em(`.ts to lib/`), `.js`; `Matches "*.ts" or "*.js"` gives em(`.ts" or "`). The opening `*` there is followed by punctuation and the closing one by `.`, so neither globs nor the text between them should turn into emphasis. Only a line with one glob, or with globs separated by spaces, stays literal.
- evidence: read
- severity: low

## Under the `'canvas'` fallback policy, fontFamilyOptions labels a family that paints in its own face "not loaded", and enrolls it as a side effect of building the list
- where: packages/ui/src/components/FontOptions/fontOptions.ts:31 (unregisteredLabel), called from :53
- scenario: an app sets the fallback policy to `'canvas'`, and a document's text uses `Georgia`, which has no atlas and no explicit canvas registration. `fontFamilyOptions({ value: 'Georgia' })` doesn't find it in either list, so it calls `resolveFontVariant('Georgia', …)`. That serves it from the dynamic tier in its real face, with no `substituted` (resolveFontVariant.ts:67–78), and the label reads "Georgia — not loaded", which is false. The same call runs `autoEnrollCanvasFont('Georgia')`, which fires no `notifyGlyphReady`, so `useFontFamilyOptions` does not rebuild. The wrong label stays until something unrelated rerenders the picker, and then it flips to a plain "Georgia" entry. Building options also runs the unsuppressed resolve, so under `'substitute'` it logs the missing-family warnings. The label is chosen from `substituted` alone. It should read the result's `source`/face, and the probe should not have side effects.
- evidence: read
- severity: low

## useFloatingPlacement lays the box out in the container's content box but positions it against the padding box, so in a padded container the corners are asymmetric
- where: packages/ui/src/components/FloatingPanel/useFloatingPlacement.ts:58 (contentBoxOf) and :119 (observer `contentRect`), with the style at :181
- scenario: the panel is `position: absolute` with `left`/`top` from the strategy, and its containing block is the padding box of its offset parent, which is the default container. The container is measured as its content box, padding taken off, both before paint and by the observer. With `padding: 12px` and the default inset: snapped top-left, the panel sits `inset` from the padding edge, inside the padding. Snapped bottom-right, `x = contentW − w − inset`, so it sits `inset + 24px` from the right and bottom padding edges. A box dragged to the right edge also stops 24px short. Absolutely positioned children lay out against the padding box (`clientWidth`/`clientHeight`), not `contentRect`.
- evidence: read
- severity: medium

## The Foundations Colors story says the current theme's column updates on a theme toggle, but neither column ever re-reads
- where: packages/ui/src/components/Foundations/Foundations.stories.tsx:322 (ThemedSwatch) and :339 (the intro text)
- scenario: the intro says "drag the theme toggle and watch only the 'current' side update". Both swatches set `data-wzl-mode` themselves (`dark` and `light`), and each reads its value once in a layout effect keyed on `[token]` only. Toggling the workshop's mode changes neither the forced modes nor the effect's deps, so no hex value updates. A theme edit made live (TokenPanel) doesn't show either. The story describes behavior it doesn't have.
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

<!-- done: 8 findings, files read: 46 -->
