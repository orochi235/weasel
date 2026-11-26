---
'@weasel-js/svg': minor
---

`@weasel-js/svg/animate` writes a clip out as an SVG animated by CSS keyframes or by SMIL.

`serializeCssAnimatedSvg(nodes, clip)` and `serializeSmilAnimatedSvg(nodes, clip)` take the same arguments. Each sampled track named `<id>.<property>`, as the SVG import names them, runs on the node with that id: as one `@keyframes`, or as one `<animate>` inside the node's element; a property the element cannot take is skipped with a warning. Either file parses back to a clip that plays the same, with a trim read back as the dash it is drawn with. A trim is drawn as one dash on `pathLength="1"` across every subpath, hidden while the trimmed span is empty; an edge with no track rests at the node's own trim. `dashTracksOf(clip)` gives that lowering on its own.

<!-- entry: rank=10 new api -->
