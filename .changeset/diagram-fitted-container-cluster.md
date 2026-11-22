---
'@weasel-js/diagram': minor
---

A scene layout arranges what a fitted container holds and fits its box around it, as `diagramScene` does.

This holds for `layoutDiagram`, `diagram.layout` and `useLiveLayout`, each write and each live frame.

A fitted container's trait now carries the `inset` it keeps round its members (`DiagramContainer.inset`), which `diagramScene` writes; one without it keeps its header and `DEFAULT_CLUSTER_INSET`. `layoutPoses` takes a fourth argument, `fixed(id)`, naming nodes another gesture owns: a fitted container holding one keeps its frame for that frame.

<!-- entry: rank=10 new behavior api -->
