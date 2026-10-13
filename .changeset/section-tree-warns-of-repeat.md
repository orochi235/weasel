---
'@weasel-js/labkit': patch
---

`sectionTree` warns once when a section's first row repeats its heading ("Pump" under "Pumping"), as `ControlPanel` does. The rail still draws that row under the heading: `PrefsForm` has nowhere to put a control in one. A schema both surfaces draw warns once, in the words of whichever met it first.
