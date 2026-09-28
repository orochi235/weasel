---
'@weasel-js/text': patch
'@weasel-js/core': patch
'@weasel-js/font': patch
'@weasel-js/svg': patch
'@weasel-js/ui': patch
---

Text runs carry a numeric weight. `StyledRun.fontWeight` (100–900) overrides the node's weight and the `bold` flag, which is now a preset over it: writing either one to a range drops the other. `numericWeight` and `isBoldWeight` (600 and up) are exported as the one reading of a weight.

Taking bold off part of a bold node now writes `fontWeight: 400` over that part and leaves the node alone, instead of lowering the node and re-bolding the rest — so it works at any node weight, including 900, where it used to be refused. `SetFlagResult.applied` is gone, since the edit can no longer be declined. `effectiveRangeStyle` reports the `fontWeight` that renders and reads `bold` off it; `patchRangeStyle` lays an armed style over a range the way a write would.

`listFontWeights(family)` in `@weasel-js/font` reports the weights a family has on the atlas and outline tiers. A new `font-weight` pref kind draws `FontWeightSelect`, which lists those weights (the nine CSS weights for a family with none on file) and reads the family from the `fontFamily` leaf beside it. The text tool's character options and the node panel's Weight field both use it. The overlay and SVG round-trip a run's weight; a tspan `font-weight` other than 700 now reads as the run's weight rather than being dropped.
