---
'@weasel-js/ui': patch
---

`TokenPanel` draws a scale as one slider with a thumb per step, on a logarithmic track so steps a constant ratio apart sit evenly, each labeled with its step name and amount. An arrow key moves a step by one unit of the scale's precision. Under the `each` rule a dragged step changes its own factor, so the scale stays generated; the factor fields under each step are gone. A scale with mixed units or a step at zero keeps the grid of numbers.

`Slider`'s `below-thumb` readouts no longer overlap: one that would overlap its neighbor drops to a row of its own, and the readout area grows to fit.
