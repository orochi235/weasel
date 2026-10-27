---
'@weasel-js/diagram': patch
---

The port affordance reads a `ParticipantSource` with a `generation()` once per generation: painting reuses those ports, and the regions built from them, instead of laying out every participant's ports each frame. The press index builds over the same list. A source without a generation is read every frame as before.
