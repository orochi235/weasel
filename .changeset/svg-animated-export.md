---
'@weasel-js/svg': minor
---

`@weasel-js/svg/animate` writes a clip out as an SVG animated by CSS keyframes or by SMIL.

`serializeCssAnimatedSvg(nodes, clip)` and `serializeSmilAnimatedSvg(nodes, clip)` take the same arguments. Each sampled track named `<id>.<property>`, as the SVG import names them, runs on the node with that id: as one `@keyframes`, or as one `<animate>` inside the node's element. Either file parses back to the clip that wrote it. A trim is drawn as one dash on `pathLength="1"` across every subpath, hidden while the trimmed span is empty. `dashTracksOf(clip)` gives that lowering on its own.

<!-- entry: rank=10 new api -->
