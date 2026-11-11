---
'@weasel-js/cursor': patch
'@weasel-js/path-tools': patch
---

`@weasel-js/cursor` adds `brushRing(radius, unit)`, the `brush` ring cursor at a radius in screen px. With `unit` set to `'world'`, the radius is in world units and the ring follows the zoom.

`brushRingCursor` is gone from `@weasel-js/path-tools`; call `brushRing` instead.

<!-- entry: breaking api -->
