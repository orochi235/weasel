---
"@weasel-js/plot": patch
---

Charts draw only finite geometry from any data. A quadrant point is held to the unit square, as a drag holds it, and one with a `NaN` coordinate is not drawn; a radius or stroke width that is negative or not finite takes the default, and a radius past the plot is cut to it. A radar value short of the center's is drawn at the center. A journey step with a `NaN` score draws no face. A packet field's fractional bit is read as the bit it falls in. Sankey flows whose sum is past the double range keep their proportions, and in a box narrower than a node every column starts at the box's edge.
