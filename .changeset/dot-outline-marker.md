---
'@weasel-js/diagram-formats': patch
---

DOT keeps outlines it has no exact shape for. A stadium, and any outline DOT has no shape of its own for (the network devices, BPMN gateways and events, and the rest), is written with a `weasel_outline` attribute beside the box Graphviz draws, and read back as itself. A rounded box without one now reads as `roundRect` rather than `stadium`, which is how Graphviz draws it.
