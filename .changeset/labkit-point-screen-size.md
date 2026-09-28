---
'@weasel-js/labkit': patch
---

A `point` annotation's ring now holds a fixed screen size, like a selection handle, instead of growing and shrinking with the picture, and clicking anywhere in the ring picks it at every zoom. `markCommands` and `markSvgNodes` take an optional view scale for this; without one the ring is drawn as though a world unit were a pixel. Captures size the ring in the export's own pixels.
