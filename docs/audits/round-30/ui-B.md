# Audit round 30 — ui-B (packages/ui, ui-input, ui-canvas, ui-logic)

## liveSelection's revert cannot restore a single selection's null or off-list value
- where: packages/ui-input/src/liveSelection.ts:27 (liveEdit → revert), with packages/ui-input/src/selection.ts:128 (single `apply`)
- scenario: `liveSelection(() => selection({ value: null, onChange }, ['a','b','c']), () => 3)`, then `sweepFrom(model, 0)`, `reach(1)` → value 'b'; `revert()` calls `apply(initial)` with every index false. Single `apply` only clears to null when `allowDeselect` is set, so the value stays 'b' instead of going back to null. Same when the press-time value was one not in `values` (a mixed-only value): revert lands on null (allowDeselect) or the swept value, never the original. The non-live `edit().revert()` restores `initial` directly, so the two revert paths disagree. Not reachable through SegmentedBar today (it sweeps only 'multiple'/'each'), but `liveSelection` and `sweepFrom` are public exports of ui-input and accept a single model.
- evidence: read
- severity: low

## Transport's and BandEditor's drawn numbers ignore an I18nProvider their spoken numbers follow
- where: packages/ui/src/components/Transport/Transport.tsx:122 (rateDrawn); packages/ui/src/components/BandEditor/BandEditor.tsx:337-338; packages/ui/src/components/BandEditor/BandRuler.tsx:41; packages/ui/src/components/QuantityText/QuantityText.tsx:49 (presented)
- scenario: e06225e34d made Transport's rate labels/aria and BandEditor's seam and edge `aria-valuetext` read `useFieldLocale()`, so `<I18nProvider locale="de-DE">` reaches them. The visible rate readout (and its sizer spans), BandEditor's min/max edge labels and BandRuler's tick labels are `<QuantityText>` with no `locale`, and QuantityText never reads `useFieldLocale` — it falls to quantity's `defaultLocale()` (the browser's). In an en-US browser under a de-DE provider the rate slider's detent labels read `1,5x` while the readout beside it reads `1.5x`; a BandEditor seam is spoken `0,5` and its ruler shows `0.5`. Slider passes `locale` explicitly, so it is consistent; these three call sites are not. (QuantityText's own doc still says "Default `en-US`", which defaultLocale no longer is.)
- evidence: read
- severity: low

## Escaping a sweep that crossed a mixed segment writes "off" instead of putting the mixed state back
- where: packages/ui-input/src/liveSelection.ts:16-17,28 (liveEdit's `initial` and `revert`); packages/ui/src/components/PanelCells/cells.tsx:158-163 (FlagBar onChange)
- scenario: a SelectionPanel flag bar over two nodes, one bold and one not, so Bold is in `mixedValues`. Drag from Italic across Bold: each step reports through the bar's onChange and FlagBar commits `field.onChange(true)` for Bold on every node. Press Escape: `revert` applies `initial`, which recorded Bold as `stateOf === 'on'` → false, so FlagBar sees Bold go from on to off and commits `field.onChange(false)` to both nodes. The node that was bold before the drag ends unbolded, and two undo entries remain. SegmentedSweepProps documents "Escape or a lost pointer puts them back"; for a mixed segment it cannot, since revert only knows on/off. Same for any `mode: 'multiple'` SegmentedBar/ToggleChips/CheckboxGroup with `mixedValues` and `sweep`.
- evidence: read
- severity: medium

<!-- done: 3 findings, files read: 60 -->
