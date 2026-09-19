---
'@weasel-js/svg': patch
'@weasel-js/labkit': patch
---

`serializeSvg` now reports through `onWarn` what the document cannot carry the way weasel draws it, where it used to drop it silently: a stroke aligned `inner` or `outer` (SVG has no stroke alignment, so it is written centered), text that wraps at its box width (SVG text does not wrap), and text aligned to the center or bottom of its box (SVG text has no box). Weasel reads the last two back from their `data-weasel-*` attributes; other viewers draw them unwrapped and top-aligned. Each message is reported once per call. `SvgStroke` gains `align` so a bridge from a kit `Stroke` can pass it through and have the loss reported. Additive.

labkit's annotation export passes a mark's stroke alignment through, so it is reported too.
