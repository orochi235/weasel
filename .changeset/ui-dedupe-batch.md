---
'@weasel-js/ui': patch
'@weasel-js/theme': patch
---

Folds several duplicated pieces of weasel-ui into one definition each. `SwatchGrid` and `CommandPalette` change behavior or look as noted below; the rest look and behave as before.

- The transparency checker under swatches, wells, and gradient stops is one background layer, built in `components/checker.module.css`; the `--wzl-checker-a` token's description points there instead of spelling out the gradient to paste.
- `solidColorOf` decides "solid" with `@weasel-js/paint`'s `isSolidPaint`, and `PaintInput`, `PropertyReadout`, and `paintPreviewCss` read a solid paint's color through it.
- Adds `SegmentedSize`, `SegmentedVariant`, and `SEGMENTED_VARIANT_ICONS`, shared by `ToggleBar`, `ButtonBar`, and `OptionsBar`. Each bar's own size and variant types and its `*_VARIANT_ICONS` map are now aliases of these.
- `SwatchGrid` moves focus with the kit's grid roving rule: Left and Right now wrap and follow right-to-left layout, and Down from a full row lands on the last swatch of a shorter row below it.
- `CommandPalette` draws each shortcut with `ShortcutKeys`, so its keycaps are lettered in the UI font at normal weight, as every other list of actions shows them.
- `Slider` and `RangeSlider` share one stylesheet for the invisible hit area past the track and each thumb.
- `Button` passes `id` and any `data-*` attribute through to its `<button>`.
