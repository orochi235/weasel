---
'@weasel-js/ui': patch
---

A popover inside a size container or a `content-visibility` ancestor lands against its trigger, not offset by that ancestor.

Either ancestor, under `container-type: size` or `inline-size`, or `content-visibility` other than `visible`, is now read as the overlay's containing block, and `content-visibility` as clipping it.

<!-- entry: fix -->
