---
'@weasel-js/svg': minor
---

An SVG export writes a group's `background` and `border` as a box under its content, and an import reads that box back onto the group.

`svgNodesFromKit` writes such a group as a `<g data-weasel-group-box="true">` holding the box as a path, then a `<g>` of the group's content carrying its clip, so the clip does not cut the border and any SVG reader draws what the canvas does. `svgNodesToKitDrafts` reads that shape back as one group with `data.background`, `data.border`, and the box as its pose; a marked `<g>` edited out of that shape reads as the group it now is. `SvgKitLeafData` gains `border`, and `SvgGroupNode` gains `groupBox`.

<!-- entry: api new data -->
