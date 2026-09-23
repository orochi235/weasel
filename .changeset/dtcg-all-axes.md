---
'@weasel-js/theme': patch
---

`toDTCG` now carries every axis, so a theme round-tripped through `toDTCG` and `loadDTCG` keeps its `compact` and `roomy` density values instead of flattening to the default. The plain `primitives` and `modes` groups are unchanged: they still hold mode, with every other axis at its default. The rest travels in the document root's `$extensions["com.weasel.axes"]`: the theme's axis definitions, which tokens vary by which axes, and one override layer per non-default axis value a token depends on. The README's "Axes in DTCG" section documents the encoding. `loadDTCG` reads it back, and a document without it loads exactly as before. Mode values now also keep their `scheme` through the round-trip.
