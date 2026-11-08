---
'@weasel-js/diagram': patch
'@weasel-js/diagram-formats': patch
---

Fix diagram placement in paged scenes and diagram-formats ids

- A label added by double-clicking an edge goes on the edge's page in a paged scene, as a connect places the edge, instead of at the top of the tree outside the page run.
- A sequence started by the Participant tool goes on the page under the click in a paged scene, instead of outside the page run.
- `documentFromScene` sizes the one page of a scene with no pages around its shapes. Connectors, stored as an empty box at the origin, no longer stretch the page back to (0, 0).
- A DOT cluster whose short name and full name are both node ids gets a container id no node holds.
- New `edgeLabelIdOf` and an exported `groupLabelIdOf` name the label node of an edge and of a group, which several places spelled out by hand.
