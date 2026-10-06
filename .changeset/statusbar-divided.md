---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

`StatusBar` takes `divided`, which draws a hairline between neighboring items, and now keeps to one line, clipping readouts it has no room for instead of letting them spill past its edge. labkit's chrome lays out its status region with it, putting the first readout marked `end` and those after it past a `StatusBarSpacer`. labkit's own `StatusBar` primitive is unchanged for now and will be retired.
