---
'@weasel-js/font': patch
'@weasel-js/text-shaping': patch
'@weasel-js/bidi': patch
---

Fixes to glyph outlines, local font weights, and loads that fail once.

- A glyph outline whose parser leaves a contour open before a relative `m` keeps its contours in place. Closing that contour moved the pen back to the contour's start, so the `m` and every contour after it landed somewhere else. Such a contour now stays open as written; every other contour is still closed.
- `parseFontStyle`, and so `enableLocalFontOutlines`, reads a lone `Demi` as 600, `DemiLight` as 350, and a numbered `W0`–`W9` weight (Hiragino Sans on macOS) as its number times 100, `W0` sharing 100 with `W1`. Before, all of them read as 400 and the faces of a family collided in one slot.
- `loadShaper` tries again after a load that failed, and the outline tier imports `opentype.js` again after an import that failed. Before, one failed fetch left every later call failing for the rest of the session.
- A closing bracket that starts a piece of text in its opening bracket's script is shaped in that script's direction, as its opening bracket was: the `)` of `שלום (abc)` is now shaped right to left.
- Doc fixes: `DEFAULT_BAKE_BUDGET` names `subscribeGlyphReady`, and the bidi README says that `@weasel-js/text-shaping` depends on it.
