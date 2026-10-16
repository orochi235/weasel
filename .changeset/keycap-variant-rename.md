---
"@weasel-js/ui": patch
---

**Breaking:** `KeyCap`'s and `KeySequence`'s variants are renamed. The unfilled chip whose border and legend follow `currentColor`, which was `'minimal'`, is now `'default'`, and is what a chip with no `variant` draws. The filled chip, which was `'default'`, is now `'inverse'`. Pass `variant="inverse"` to keep a chip that relied on the old default filled, and drop `variant="minimal"`. The chip writes `data-variant="inverse"` for the filled one and no attribute for the default. `KEYCAP_VARIANT_ICONS` follows the new names.
