---
'@weasel-js/diagram-formats': patch
---

draw.io export writes inclusive and event-based BPMN gateways the way draw.io's own palette does, as an event outline
inside the diamond (`outline=end;symbol=general`, `outline=catching;symbol=multiple`); the `gwType` values it wrote
before are not ones draw.io knows, and drew a bare diamond. Import reads draw.io's forms and the earlier ones. A
`globe` node goes out as `mxgraph.office.concepts.globe_internet` rather than a rectangle.
