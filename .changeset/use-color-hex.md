---
'@weasel-js/theme': patch
---

New `useColorHex()` in `@weasel-js/theme/react`: turns a `ColorSource` into a hex color under the theme, tones and palette in force, for paint that a canvas draws without the cascade. `useColorCss` answers a theme token as `var(--wzl-…)`, which a scene's paint cannot read; this answers the token's value in the mode in force, so a scene drawn with `{ ref: 'workspace-surface' }` follows a light/dark switch. Additive.
