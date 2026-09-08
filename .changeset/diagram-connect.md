---
'@weasel-js/diagram': patch
---

Ports are grabbable, and dragging one onto another authors an edge.

`diagramPorts` returns the two halves the gesture needs: a port affordance layer
for `CanvasExtensionApi.registerLayer`, and a `Contribution` for `ambient`. They
come back together because attaching one without the other fails quietly — the
layer alone paints ports that start no gesture, and the contribution alone binds
a hit nothing reports. `registerLayer` is the only attach route the kit
hit-tests; a `Contribution.overlay` is painted and never hit.

Connect is an ordinary drag binding gated on the port layer's affordance kind,
not a mode and not a tool, so it starts from whatever tool is active. The
preview is a real routed edge — the same router the committed edge will use,
resolved by the same function, so it cannot promise something the release will
not do. The commit is one `add`, which undoes in one step.

Typed validity is `canConnect`, defaulting to "a port may not join itself, and
two ports that both declare a `type` must declare the same one". An untyped port
joins anything, so an untyped diagram stays fully connectable. It is applied
where candidates are gathered rather than at the commit: an illegal port is
never a candidate, so the edge will not snap to it and releasing over it does
nothing.

A port claims the whole `'pointer'` protocol so a port drag is never a move of
the node underneath. That means `pointerDown` and `click` need bindings too —
an exclusive claim bars every binding whose target does not consult the
affordance, so a bundle that binds only `drag` leaves the press with nowhere to
go and the dispatcher drops it, along with the drag it would have become.

Also fixed: an edge's trait and a participant's trait live under the same
`data.diagram` key, and the reader could not tell them apart. An edge read as a
participant declares no ports, so it collected the four defaults on the
degenerate pose an edge carries — four grabbable ports in the middle of nowhere.
`from` and `to` are now what distinguishes the two.
