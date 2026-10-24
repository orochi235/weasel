---
"@weasel-js/ui": patch
---

`stereo({ invert: true })` swaps the label bar's fill and title colors, and the border takes the title's color. Every stereo frame now pads its bar by its reading direction, so a side bar is no thicker than a top one; rounds the inside corners where its body meets the bar; sets a frame after another apart by a little more than the rows; and centers its rows down a side bar whose title runs longer than they do.
