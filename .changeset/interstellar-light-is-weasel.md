---
'@weasel-js/labkit': patch
'@weasel-js/theme': patch
---

`interstellar`'s light mode is weasel's own: violet on cool gray, where it used to be a parchment palette with a copper accent. The theme restyles the dark mode only.

`derive` now lets a child theme's by-axis pin leave a value out, as `defineTheme` already did: that selection keeps what the parent theme produces, whether the parent pins the token or derives it. A pin with nothing underneath it still reports `missing-axis-value`.

`--wzl-secondary-fg` is picked for contrast against `surface` alone, which is solid in every shipped theme, rather than also against `surface-raised`, which `interstellar` draws translucent.
