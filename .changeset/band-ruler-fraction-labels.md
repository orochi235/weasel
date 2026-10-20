---
'@weasel-js/ui': patch
---

A stacked fraction is drawn in the UI face with proportional digits, so a 1 over a single digit sits centered
rather than leaning in an equal-width slot, and its bar runs a little past the digits on the right. The
BandEditor ruler centers each label on its tick's middle rather than its left edge, and sets labels 3px clear of
the notches instead of 1px; the ruler is 2px taller to keep them inside it.
