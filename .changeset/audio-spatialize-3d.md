---
'@weasel-js/audio': patch
---

`spatialize`, the engine's `setListener` and voice positions now work in a 3D scene. A position takes an optional `z`, read as 0 when absent, and gain falls with the full 3D distance. A new `right` option gives the listener's right as a direction (default `{ x: 1, y: 0, z: 0 }`), and pan is the source's offset along it over `panWidth`. 2D callers get exactly the same numbers as before. The position type is now `SpatialPoint`; `Vec2` stays as a deprecated alias of it.
