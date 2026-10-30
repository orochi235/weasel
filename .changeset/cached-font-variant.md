---
'@weasel-js/font': patch
'@weasel-js/text': patch
'@weasel-js/hud': patch
---

New `cachedFontVariant(family, weight, style)` in `@weasel-js/font` resolves a face as `resolveFontVariant` does,
but hands back one frozen result per face for an exact match rather than a new object every call. Text layout,
painting and run resolution now read faces through it, so a HUD readout rewritten every frame no longer
allocates a result per label. `resolveFontVariant` still returns an object of the caller's own on every call.
