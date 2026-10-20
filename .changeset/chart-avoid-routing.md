---
"@weasel-js/core": patch
"@weasel-js/diagram": patch
---

Connectors can route around shapes. The `avoid` router draws a connector orthogonal, with few bends,
clear of every shape, and with parallel runs spread apart. Its route is computed when the scene is
edited and stored on the edge as `diagram.route`, so a saved file draws it without rerouting and
undo restores it exactly; a stored route that no longer fits its ends draws as `orthogonal`.
`useAvoidRouting(scene)` (or `installAvoidRouting` outside React) reroutes whatever each edit
disturbed in that edit's own undo entry, and reroutes the connectors near a dragged shape every
frame. Containers, pools, and group boxes are in the way only of connectors with neither end inside
them; lane bodies never are; headers always are. Dragging a segment of an `avoid` connector pins
only that segment. `DiagramView` takes `router="avoid"`, and `createAvoidRouter` — the search alone,
over plain boxes and ports — is in `@weasel-js/diagram/layout`. New commands set the selected
connectors' router (`SET_ROUTER_ACTION_IDS`), and layout no longer writes waypoints to an `avoid`
connector.

Core adds scene edit passes: `scene.addEditPass(pass)` hears each live edit's added, removed,
posed, re-parented, and data-changed ids once its own mutations and the arrival handler have run,
and its ops join the same undo entry. Passes never re-trigger on their own writes, and undo, redo,
and history replay never run them. While any pass is added, a bare scene call runs as an edit of
its own.

weaselchart's connector tool draws connectors that route around shapes, and Format › Connector
picks Around shapes, Orthogonal, Straight, or Curved for the selected connectors. Charts saved
before keep the router they have.
