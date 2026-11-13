---
'@weasel-js/svg': minor
---

A text node with a background, such as a sticky note, reads back from SVG as one text node instead of a rectangle and a separate text.

`svgLeafFromKit` marks the group it writes for one (`data-weasel-text-frame`, the new `SvgGroupNode.textFrame`), and `svgNodesToKitDrafts` drafts that group as a single text leaf carrying `background`, `padding`, and `overflow: 'clip'` where it clips. The edge and shadow are drawn shapes SVG has no attribute for; a `leaf` callback gets the text with the group's `meta`, so a document that writes them into its own namespace can read them back.

<!-- entry: api data -->
