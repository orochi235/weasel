---
'@weasel-js/ui': patch
---

The straight arrows in `import`, `export`, `pan`, `arrowLeft`/`Right`/`Up`/`Down`, `enter`, `leave`, `loop`, `sort`, `dollyIn`, `dollyOut`, `rise` and `sink` are redrawn on the 16px pixel grid: each shaft runs down a pixel center, and each head's barbs end two whole pixels back from its tip and two either side, at 45 degrees. At 1x the shafts no longer smear across two gray columns and the heads no longer close up into dots. The glyphs sit half a pixel left of and above where they did, the same as the size glyphs.
