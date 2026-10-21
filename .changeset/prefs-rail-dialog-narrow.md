---
'@weasel-js/ui': patch
---

A rail-layout `PrefsDialog` fits the room it is given. Its settled width of up to 800px is now clamped to the overlay it opens in rather than to the window, so in a contained portal narrower than the window the box no longer runs past its edge. In a narrow window or portal the pane's label and control columns shrink below 140px and 180px, so the fields stay inside the box instead of being cut off at its right edge.
