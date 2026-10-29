---
'@weasel-js/diagram-elk': patch
---

`elkPlan` names the port on the face of the node ELK's route meets, nearest first, rather than the
nearest port overall, which on a wide box could sit on another face and draw the wire across the box.
