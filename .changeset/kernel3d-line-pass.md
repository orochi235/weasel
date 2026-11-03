---
"@weasel-js/kernel3d": patch
---

kernel3d draws lines: `packLines` turns polylines into vertices and `createLinePass(gl)` draws them into a
WebGL2 context the host owns. Each line is widened in screen pixels after projection, so it keeps its width
at every depth; corners miter along the bisector, a segment with an end behind the eye is dropped, and each
open run ends in an arrowhead capped at a share of the line, its shaft narrowing to match. A line takes a
`StrokeTrim`, measured in its own space before its `model` places it, so it can draw itself on. This is new
API, and kernel3d now depends on `@weasel-js/paint` and `@weasel-js/stroke`.
