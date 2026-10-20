---
"@weasel-js/diagram": patch
---

`EffectEditor` edits wire routes under the `rack` and `lanes` looks as well as `nodeGraph`. A
selected wire shows its route handles, and a drag reports `'Edit route'` with the route in the new
`EffectDoc.lookRoutes`, kept by look and by wire together with where the wire's two ports were drawn.
Since these looks move stages on every reorder or added stage, a route is drawn only while both
ports are still there, and otherwise the look routes the wire itself. Reset route gives the wire
back to the look. `setLookRoute`, `applyLookRoutes`, `pruneLookRoutes`, and `wireEnds` are exported
from `@weasel-js/diagram/effect`, and so is `setWireRoute`, which the README already named.

A reorder now drops the routes, under every look, of the wires it rewires or removes, so a new wire
that takes a freed id starts unrouted. Removing a wire or a stage drops its routes under every look.
Files saved before have no `lookRoutes` and load unchanged.

weaselchart's pipeline mode gains Format › Connector › Reset route.
