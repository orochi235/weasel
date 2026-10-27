---
'@weasel-js/theme': patch
---

`themePrefsSchema` names a token's leaf without its group's prefix, since the leaf sits on that group's page: `button-pressed-surface` reads `pressed-surface` on the Button page, and `gray-50` reads `50`. The whole token name is the leaf's tag, so a settings filter still finds it, and the leaf's path is unchanged.
