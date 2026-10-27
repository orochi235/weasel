---
'@weasel-js/core': patch
'@weasel-js/kernel3d': patch
---

A `@weasel-js/kernel3d` move or nudge of several roots moves them as one body. Each root used to turn the screen delta into a world delta on the plane at its own height and from its own place on screen, so roots moved by slightly different amounts and only the first landed on what the snap held it to. `PoseDescriptor.translate` takes an optional fourth argument, `lead: { from, to }`: how the move's first root went under the same delta. Core's move, nudge and `moveNodes` pass it for every root stored in world space, and kernel3d's descriptor moves each root by the lead's world change. `TranslateLead` is exported. A descriptor that ignores the argument behaves as before.
