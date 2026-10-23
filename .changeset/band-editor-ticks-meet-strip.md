---
"@weasel-js/ui": patch
---

`BandEditor`'s ruler ticks, the range-end ticks included, now run down across the gap to the top edge of the band strip instead of stopping one gap above it. The tick labels stay where they were, and the ticks take no pointer, so the ruler's click-to-split area is unchanged.
