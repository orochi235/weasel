---
'@weasel-js/ui': patch
---

Add glyphs for component variants, in a new Component variants group. `variantSolid`, `variantOutline`, `variantSubtle`, `variantGhost`, `variantLink`, and `variantPlain` draw one chip with less chrome at each step. `variantSegmented`, `variantSegmentedMinimal`, and `variantSegmentedFlat` draw the three styles of segmented bar.

Each component with a `variant` prop exports a map from its variants to these glyphs, for a picker that shows them: `BUTTON_VARIANT_ICONS`, `BADGE_VARIANT_ICONS`, `CODE_VARIANT_ICONS`, `KEYCAP_VARIANT_ICONS`, `TOGGLE_BAR_VARIANT_ICONS`, `BUTTON_BAR_VARIANT_ICONS`, and `OPTIONS_BAR_VARIANT_ICONS`. The variant controls in the Button, Badge, Code, Powerline, KeyCap, and KeySequence stories now show them.
