---
'@weasel-js/svg': minor
---

`parseSvg` reads an SVG's CSS animations (`@keyframes` and `animation`) into `ParseResult.clip`, beside its SMIL.

Each property an animation moves becomes a track named as SMIL's are, `<id>.<property>` or `<id>.transform.<type>`, so `svgClipBinder` plays them the same way. Iteration count, direction, delay, fill mode and timing functions are laid out as keys. A transform of one function throughout imports, with a `transform-origin` in px. `linear()` easing, `steps()` that jump at both ends or neither, a percentage origin, and a transform of several functions are each reported in `warnings` rather than carried.

<!-- entry: rank=5 new -->
