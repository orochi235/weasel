---
"@weasel-js/font": patch
"@weasel-js/core": patch
---

New `warmFonts(families?)`, additive: loads registered MSDF atlases ahead of their
first use and resolves once they land, the font counterpart of `warmPaintKinds`.
With no list it loads every family passed to `registerFont`, starting lazily
declared variants and joining fetches already running. It rejects when a load
fails, or for a family that was never registered.

`renderSceneToPixels` and a `RasterSession` render synchronously, so text set in
a face registered `{ lazy: true }` draws nothing until its atlas has been
fetched — and nothing fetches it until text first asks. `await warmFonts()`
before a headless render that contains text.
