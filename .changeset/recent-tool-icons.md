---
'@weasel-js/path-tools': patch
'@weasel-js/core': patch
---

More tools and actions gain icons. In core, the Bone and Weight tools (`BoneIcon`, `WeightIcon`) and Bend segment (`BendSegmentIcon`). In `@weasel-js/path-tools`, Trim segment and Extend to next path get their own (`TrimIcon`, `ExtendIcon`) in place of the Slice knife, on both tool and action; Reverse path, Set path start, Set corners and the corner radius drag, Next corner shape, Convert segments with a straight and a curved variant, and Add extreme anchors get one each; and `GirthIcon` is drawn for the Girth tool. The shared SVG base the package's icons are drawn on moves into one module.
