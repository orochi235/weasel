---
'@weasel-js/renderer': patch
---

`cullDrawCommands` keeps or drops a `retain` group whole, so a group partly off screen composites its retained surface instead of redrawing it every frame.

<!-- entry: fix perf -->
