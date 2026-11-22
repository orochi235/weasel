# Audit round 68 — ui.components.part4

## A `<kbd>` shortcut is not kept whole inside a mark or a link label, so a key in it can close the mark
- where: packages/ui/src/components/InlineMarkdown/inlineScan.ts:38 (unitEnd), used by walk at :128
- scenario: `unitEnd` treats a backslash pair and a code span as one unit, so a close character inside either can't end
  the enclosing mark's text. A `<kbd>…</kbd>` span gets no such treatment, so the walk reads its characters one at a
  time. Take `[<kbd>Mod+]</kbd>](#bring-forward)` (Mod+] is a real shortcut, Bring Forward). `link()` walks the label
  with LABEL's stop `]`, stops at the `]` inside the kbd, sees `<` instead of `](`, and refuses the link. The line comes
  out as the literal `[`, a keys token, then the literal `](#bring-forward)`. In the same way `*press <kbd>Mod+*</kbd>*`
  closes the emphasis at the `*` inside the kbd: you get em(`press <kbd>Mod+`), drawn as literal text, then
  `</kbd>*`. What should happen: the kbd span is one unit, as `matchAt` would read it, and the link or emphasis
  wraps the keys token. Commit 081ca62d08 fixed this for code spans; kbd spans were left out.
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

<!-- done: 1 findings, files read: 46 -->
