---
'@weasel-js/diagram': patch
---

`radial` keeps a branch on the side of the root it was dragged to. On a mind map whose branches already stand on both sides of the central topic, a branch clear of the root stays on its side when the layout runs again, and the branches near the root are dealt to the lighter side after those. A map with every branch on one side, as `tree` or `layered` leaves one, is still dealt afresh and balanced.
