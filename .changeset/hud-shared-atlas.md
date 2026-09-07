---
'@weasel-js/hud': patch
---

A HUD can draw with a family the host already registered, instead of fetching
its own copy of the same atlas.

Every weasel app registers Inter for its own text; `@weasel-js/hud` registered a
byte-identical second copy for its widgets. Measured on the demo site: 152,162
wasted transfer bytes, two wasted requests and a second `createImageBitmap` over
bytes already in memory.

`attachHud` and `useHud` take `font`:

- a family name — that family, already registered by the host. Nothing is
  fetched.
- a `{ metricsUrl, atlasUrl }` pair — the HUD's own family, registered from the
  host's copy of the atlas.

Unset, the bundled atlas is fetched as before. The demos and WeaselDraw pass
`font: 'sans-serif'`; their HUD canvases render pixel-identically with the atlas
fetch gone.
