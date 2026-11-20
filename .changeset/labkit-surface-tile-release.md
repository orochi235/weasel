---
'@weasel-js/labkit': minor
---

`SurfaceHandle.registerTile` returns a release that drops the element it placed only while that element still holds the id.

A release that runs late leaves the element that has taken the id since alone. `registerTile(id, null)` still drops whatever holds the id. Code implementing `SurfaceHandle` itself, such as a test double, returns a function from `registerTile`.

<!-- entry: api fix -->
