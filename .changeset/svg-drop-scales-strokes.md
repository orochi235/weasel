---
'@weasel-js/svg': patch
---

`unpackSvgFiles` shrinks an oversized SVG to fit the viewport, and scaled poses and font sizes but not strokes: a 4000-unit drawing with 4-unit strokes landed at 18% size with strokes still 4 wide. Stroke widths, dash patterns, and letter spacing now take the same scale. A non-scaling (`{ px }`) stroke keeps its screen width.
