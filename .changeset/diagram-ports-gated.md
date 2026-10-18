---
'@weasel-js/diagram': patch
---

A hidden or locked node shows no ports. `sceneParticipants` marks each participant `hidden` or `locked` from the scene's `nodeGates`, and the port layer neither draws nor hits a marked participant's ports, and a connect never lands on one. A node is hidden by its own flag, an ancestor's, or a hidden layer; locked by its own lock, an ancestor's, or a locked layer. `ParticipantPose` gains the two optional fields, so a hand-written participant source can set them too. The graph still reads every participant, so layout places a hidden node as before.
