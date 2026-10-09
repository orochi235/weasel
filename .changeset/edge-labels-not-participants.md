---
"@weasel-js/diagram": patch
---

An edge label is no longer read as a diagram participant. The default trait reader took its `data.diagram.label` for a participant's trait, so a scene layout (`applyLayout`, `useLiveLayout`, `DiagramView`) gave every label a slot of its own, and the port affordance gave each one four ports.
