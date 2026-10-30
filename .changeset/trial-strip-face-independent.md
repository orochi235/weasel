---
'@weasel-js/labkit': patch
---

A trial's status strip is its final height on the first layout, whatever face its readouts draw in,
so a new trial's view is placed once rather than refit when the numeric face arrives. The strip keeps
the height the face gave it at the default density; the scale readout now centers on the row like
the frame-rate readout, about 1.5 px higher than before.
