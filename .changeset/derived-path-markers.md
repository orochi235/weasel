---
'@weasel-js/core': patch
'@weasel-js/diagram': patch
---

A stroke marker on a derived path is drawn.

`markerStart` / `markerMid` / `markerEnd` reached the `kit:derived` painter
intact and were then dropped: the painter emitted its stroke command and
returned, where `kit:path` follows with a marker pass. So an arrowhead on a
diagram edge — the whole reason markers and derived geometry landed in the same
release — silently drew nothing. Its own `ink` had been reserving the hit-test
reach for the marker all along, which is the shape of the bug: the pointer could
already grab past the end of a line with no head on it.

A connect-authored edge now carries `markerEnd: 'arrow'` by default. An edge
runs *from* one node *to* another and a plain line does not say so;
`DEFAULT_EDGE_STROKE` is exported for a consumer overriding `commit` who wants
the rest of it.
