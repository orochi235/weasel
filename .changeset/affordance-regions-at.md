---
'@weasel-js/core': patch
'@weasel-js/diagram': patch
---

`Affordance` takes an optional `regionsAt(state, wx, wy, view)`: the regions a press at that world point can hit, in the order `regions` lists them. The affordance hit test reads it in place of `regions` when it is there, so an affordance with many regions can answer from an index. This adds API.

The diagram port layer and edge-label layer use it. A `ParticipantSource` may carry a `generation()`, and `sceneParticipants` gives it one from the scene's version and its overrides' generation, so the port layer hit-tests through an index of the ports' points instead of laying out every participant's ports on each press. The label layer and `labelUnder` index each scene's draggable labels against its version. Both answer exactly what they answered before; a source without a generation is tested the old way.
