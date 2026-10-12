---
'@weasel-js/svg': patch
---

Adds API: `parseSvg(svg, { keepHidden: true })` keeps the content SVG does not render, `display="none"` elements and leaves under `visibility="hidden"`, and marks each kept node `hidden`. `serializeSvg` writes a `hidden` node with `display="none"` and leaves it out of the `viewBox` it computes, and `svgNodesToKitDrafts` carries the flag onto the draft, for a caller to map onto whatever it hides a node with. Without the option a parse leaves hidden content out, as before, and `unpackSvgFiles` does not ask for it: a scene node has no hidden state of its own.

The option, the flag's name, and writing a `visibility`-hidden leaf back as `display="none"` were an agent's judgment.
