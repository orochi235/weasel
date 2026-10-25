---
'@weasel-js/diagram': patch
---

Two new stencil groups and diagram types. `NETWORK_GROUP` holds a server, database, cloud, router, switch, firewall, laptop, desktop, phone, printer, user, and internet globe; `BPMN_GROUP` holds start, intermediate, and end events, a task, a subprocess, the exclusive, parallel, inclusive, and event-based gateways, a data object, and a data store. `DIAGRAM_TYPES` gains `network` (straight links with no end marker) and `bpmn` (orthogonal flows ending in an arrow), each opening with its own group and the containers.

The devices, events, and gateways are new built-in outlines (`server`, `router`, `switch`, `firewall`, `laptop`, `desktop`, `phone`, `printer`, `user`, `globe`, `event`, `intermediateEvent`, `exclusiveGateway`, `parallelGateway`, `inclusiveGateway`, `eventGateway`, and `subprocess`) seeded in the outline table, so a saved chart naming one paints without its group imported. Devices, events, and gateways keep their proportions and lay their label out in a strip under the drawing. The actor's figure now stands on its label strip when its box is too narrow for it, rather than leaving a gap above the label.

`DiagramStencil` takes an optional `style`, a partial node style laid over the one the body is drawn in; the BPMN end event uses it for its heavier ring. Each new stencil has a palette glyph in the `diagram` icon namespace.
