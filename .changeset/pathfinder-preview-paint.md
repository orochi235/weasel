---
'@weasel-js/core': patch
---

A Pathfinder action's preview now draws each piece in the paint it would wear — its source's paint, or the paint a counted stroke leaves it — with the overlay's outline over it, rather than as a plain outline. `TransientPath` takes an optional `paint` (a `PathPaint`) to do this for any path an overlay shows.
