---
'@weasel-js/svg': patch
---

`parseSvg` baked an ancestor `transform` into coordinates but left the lengths beside them at source size: under `<g transform="scale(10)">` a 0.5 stroke stayed 0.5 wide, text kept its font size, and a `userSpaceOnUse` gradient stayed where it was while its shape moved. Stroke widths and dashes, font sizes, letter spacing, and user-space gradient geometry now go through the same transform, and text and images under a rotated group turn with it. A stroke under a non-uniform scale takes the uniform part and warns.
