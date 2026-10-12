---
'@weasel-js/text': patch
---

Fixes: a family with outlines registered and no atlas dropped any character its face lacks, with no warning, so an em dash or an emoji in it took no room and drew nothing. `layoutRuns` now escalates that character to the dynamic canvas tier under the fallback policy, as a run set from an atlas already did, and names it in the usual one-time warning when nothing can draw it.
