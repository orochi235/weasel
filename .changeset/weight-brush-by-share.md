---
"@weasel-js/animator": patch
"@weasel-js/rig": patch
---

The weight brush compares against each point's share of the active joint, its weight over the point's total, rather than the raw weight. On a skin whose weights do not sum to 1, painting a joint used to lower its share and Alt-painting used to raise it. `jointShares(skin, joint, count)` is the share the brush and the weight overlay both read.
