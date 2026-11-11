---
"@weasel-js/plot": patch
---

A git graph places a branch whose `order` is `NaN` as one with no order, by where it was created. Such a branch used to compare as equal to every other, which left the lanes in whatever order the sort happened to reach.
