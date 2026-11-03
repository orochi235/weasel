---
'@weasel-js/core': patch
'@weasel-js/svg': patch
---

`svgNodesFromKit` writes a node with a `clipFromPose`, as every page has, as a group clipped to what that returns,
ahead of `clip: 'outline'`, so an SVG export of a tree that walks its pages cuts what overhangs a page at its edge as
the canvas does. `placeOnPages` and `addOnPages` take a `pageOf` option naming the page a root was on where it was
read from: that root goes on that page where it is, unmoved, rather than on the page holding most of it.
