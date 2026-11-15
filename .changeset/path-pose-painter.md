---
'@weasel-js/core': minor
---

A node whose pose is a `Path` draws in its `data.fill` and `data.stroke` with no `drawOne`, through the new built-in `kit:path-pose` painter.

It runs behind every other painter, as `kit:rect-fallback` does for rect poses, so a painter you register for path-posed nodes still wins.

<!-- entry: new visual -->
