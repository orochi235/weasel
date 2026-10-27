---
'@weasel-js/ui': patch
---

The size glyphs (`ui:taller`, `ui:shorter`, `ui:wider`, `ui:narrower`, `ui:tallest`, `ui:shortest`) and `ui:orbit` are redrawn on the 16px pixel grid, so their arrowheads read as heads at 16px 1x instead of closing up into dots. Each head is now 45 degrees with barbs two pixels long. `ui:orbit` is a level ring that leaves its front on a straight run to the head, in place of a tilted ring with the head on its bend.
