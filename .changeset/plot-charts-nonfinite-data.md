---
"@weasel-js/plot": patch
---

Charts draw only finite geometry from any data.

A quadrant point is held to the unit square, and one with a `NaN` coordinate is not drawn; a negative or non-finite radius or stroke width takes the default, and a radius past the plot is cut to it. A radar value short of the center's is drawn at the center, and a journey step with a `NaN` score draws no face. A packet field's fractional bit is read as the bit it falls in. Sankey flows whose sum is past the double range keep their proportions.

<!-- entry: fix visual -->
