---
"@weasel-js/diagram-formats": patch
---

New package, `@weasel-js/diagram-formats`: diagram scenes to files. `exportPageSvg(scene, page)`
writes one page as an SVG document whose `viewBox` is the page, on the page color, with each
outline drawn as its shape, each connector as one path with its markers, and rows, labels, and
off-page tags as text; what lies wholly off the page is left out. `exportPagePng(scene, page,
{ scale })` draws the same page through the canvas renderer into a PNG of the page's size times
`scale`. Both take the page color from the scene's diagram theme unless given a `background`.
`pageSvgNodes` is the SVG export's node walk, for a caller writing the document itself.
