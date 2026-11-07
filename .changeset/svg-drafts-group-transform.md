---
'@weasel-js/svg': patch
---

`svgNodesToKitDrafts` honors an `SvgGroupNode`'s `transform`, as `svgNodesFromKit` writes one for a node's copies. It bakes the transform into the group's paths, paints, stroke widths and clip, and places its text and image boxes, the way `parseSvg` bakes one at parse time. Before, it ignored the transform and drafted every copy on top of the original.
