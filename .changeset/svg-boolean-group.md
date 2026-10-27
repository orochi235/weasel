---
'@weasel-js/svg': patch
---

A boolean group now exports as what it draws. `svgNodesFromKit` writes the path the group derives, in its own paint, then a `<g data-weasel-boolean="<op>" display="none">` holding its children, where it used to write the children as separate visible shapes. Another reader draws the result alone; `parseSvg` keeps that `<g>`, hidden, even without `keepHidden`, and `svgNodesToKitDrafts` drafts it back as a mark with `boolean` set and its children under it, shown. `unpackSvgFiles` inserts such a draft as a boolean group.

This adds API: `SvgGroupNode.boolean`, `SvgKitTreeNode.consumesChildren`, `SvgKitTree.derivedPathOf` (a kit `Scene` needs none) and the mark draft's `boolean`.
