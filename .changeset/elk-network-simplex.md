---
'@weasel-js/diagram-elk': patch
---

`elkPlan` and `elkPlanner` now place nodes by network simplex rather than ELK's default, Brandes–Köpf, which
could run a long edge's chain past the drawing's outermost node: on a 28-node grouped graph, 7 wires ran
outside every node and group box, by up to 197 units. Network simplex keeps them inside and drew that graph
19% narrower, at the cost of more bends (206 against 140), since it no longer lines every edge's ends up.
This changes where nodes land; pass `layoutOptions: { 'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF' }`
for the old placement.
