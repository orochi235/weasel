---
"@weasel-js/font": patch
"@weasel-js/core": patch
"@weasel-js/hud": patch
---

`registerFont` takes a fifth argument, `{ lazy: true }`, which fetches nothing
until text first lays out in that family — so a scene with no text never
downloads the atlas. Until the atlas lands, a run set in the family lays out as
nothing rather than in a fallback face's metrics, and `<SceneCanvas>` repaints
it when the atlas arrives. The returned promise settles with that load, so it
never settles for a face no text uses; don't `await` it at startup. New type:
`RegisterFontOptions`.

A family whose atlas is still fetching, eagerly or lazily, now outranks the
outline tier and the `'substitute'` fallback while it loads: text waits for the
real face instead of laying out in another one and reflowing when it arrives.
The same holds for a registered-but-unloaded exact variant, which is no longer
faked from a sibling weight in the meantime. `listFonts` and `listFontWeights`
report lazily registered faces before they load.

`@weasel-js/hud` registers its bundled Inter lazily, so attaching a HUD whose
widgets draw no text no longer downloads it. `registerDefaultFont`'s promise now
settles when a widget first lays out text.
