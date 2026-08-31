---
'@weasel-js/core': patch
---

Repaint the scene-graph side-scroller demo's world from `data.fill`. Its
tiles, coins, enemies and flagpole still declared `data.color`, the alias
removed when node paint became an object, so every one of them rendered in
the default gray — the demo whose whole point is being the visual twin of the
immediate-mode load test.
