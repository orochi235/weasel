---
'@weasel-js/cursor': patch
'@weasel-js/path-tools': patch
---

Add `brushRing(radius, unit)` to `@weasel-js/cursor`: the `brush` ring cursor at a radius in screen px, or in world units (`'world'`) so it follows the zoom. It sizes the glyph from the glyph's own ring radius. Breaking: `brushRingCursor` is gone from `@weasel-js/path-tools`; call `brushRing` instead.
