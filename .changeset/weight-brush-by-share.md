---
"@weasel-js/animator": patch
"@weasel-js/rig": patch
---

The weight brush paints each point's share of the active joint, so painting a joint raises it even on a skin whose weights do not sum to 1.

`jointShares(skin, joint, count)` is the share the brush and the weight overlay both read.

<!-- entry: fix api -->
