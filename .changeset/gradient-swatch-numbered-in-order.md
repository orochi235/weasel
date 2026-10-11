---
'@weasel-js/ui': patch
---

`GradientEditor` numbers each stop's color swatch by where the stop sits along the gradient, so a screen reader hears "Stop 1 at 0%, Stop 2 at 50%" in order whatever order the stops are stored in. A swatch still recolors the stop it stands for.
