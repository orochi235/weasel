---
'@weasel-js/stroke': patch
---

A round or square cap draws on a zero-length run, as SVG strokes one: a subpath such as `M5 5 L5 5`, and each zero-length dash, so a round-capped `dash: [0, gap]` draws a row of dots. Both drew nothing. A zero-length dash's square cap faces along its line; a zero-length subpath's faces the x axis.
