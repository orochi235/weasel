---
'@weasel-js/svg': minor
---

`@weasel-js/svg/animate` writes a clip out as an SVG animated by CSS keyframes, with `serializeCssAnimatedSvg(nodes, clip)`.

Each sampled track named `<id>.<property>`, as the SVG import names them, becomes one `@keyframes` run on the node with that id, so the file parses back to the clip that wrote it. A trim is drawn as one dash on `pathLength="1"` across every subpath, hidden while the trimmed span is empty. `dashTracksOf(clip)` gives that lowering on its own.

<!-- entry: rank=10 new api -->
