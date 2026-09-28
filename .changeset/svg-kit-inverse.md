---
"@weasel-js/svg": patch
---

Add `svgNodesFromKit`, the inverse of `svgNodesToKitDrafts`: it walks a scene (or any tree with `roots`, `childrenOf` and `get`) back to `SvgNode`s for `serializeSvg`, writing each leaf the way the kit's path, text or image painter draws it. `svgLeafFromKit`, `svgPaintFromKit` and `svgStrokeFromKit` are exported for single leaves, beside the existing `svgImageFromKit`, and `fillDataFromSvg` joins `strokeDataFromSvg` on the import side.

`svgNodesToKitDrafts` now keeps `fill-opacity`, multiplies element and group `opacity` into the paints of the leaves under them, and, when handed a whole `ParseResult`, registers the document's markers as `unpackSvgFiles` does. `fill-opacity` on a gradient-filled shape now survives both parse and serialize.
