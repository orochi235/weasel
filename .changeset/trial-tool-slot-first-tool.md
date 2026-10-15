---
'@weasel-js/labkit': patch
---

A trial whose palette opens on a tool its scene canvas has not registered, such as a path-edit tool a lab holds itself, kept it only until the canvas settled on its own default: the canvas reported no tool and then Select, and the palette followed it. The tool slot now takes a canvas report as a pick only once the canvas holds a tool and has caught up with any tool the slot asked it to take. Before that, the canvas is settling, and the slot's tool is pushed onto it rather than replaced by its default.
