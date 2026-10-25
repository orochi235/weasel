---
'@weasel-js/ui': patch
'@weasel-js/theme': patch
---

Folds several duplicated pieces of weasel-ui into one definition each. No component changes its look or behavior.

- The transparency checker under swatches, wells, and gradient stops is one background layer, built in `components/checker.module.css`; the `--wzl-checker-a` token's description points there instead of spelling out the gradient to paste.
- `solidColorOf` decides "solid" with `@weasel-js/paint`'s `isSolidPaint`, and `PaintInput`, `PropertyReadout`, and `paintPreviewCss` read a solid paint's color through it.
- Adds `SegmentedSize`, `SegmentedVariant`, and `SEGMENTED_VARIANT_ICONS`, shared by `ToggleBar`, `ButtonBar`, and `OptionsBar`. Each bar's own size and variant types and its `*_VARIANT_ICONS` map are now aliases of these.
