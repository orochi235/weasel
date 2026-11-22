---
'@weasel-js/renderer': patch
---

`cullDrawCommands` keeps or drops a `retain` group whole. A group partly off screen then reuses its retained surface instead of redrawing it every frame.

<!-- entry: fix perf -->
