---
'@weasel-js/core': patch
---

Make what a view paints hittable inside that view.

`<CanvasView>` registers an `affordanceAt` and a `classifyTarget` of its own,
built the same way the surface builds its pair but against this view's chrome
state and camera. A press inside a panel now lands on that panel's resize
handles, rotation band and path anchors, and a body under the point classifies
against the panel's selection — until now a gesture inside a panel reached only
the ambient viewport actions.

Externally registered layers keep first refusal on the point, hit-tested
against the view's frame and draw envelope rather than the canvas's.

The surface's context to its views widens to carry the hit-test half it is the
authority on: the pickers, the node-kind resolver and the chrome-caps
predicate.
