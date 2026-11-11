---
"@weasel-js/ui-logic": patch
"@weasel-js/ui": patch
---

An ordered slider's thumb stays inside its bounds and between its neighbors when dragged or set by a track click.

`clampOrdered` holds it there even when a neighbor sits too close for the step it keeps.

<!-- entry: fix -->
