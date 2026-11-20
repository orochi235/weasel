---
'@weasel-js/diagram-formats': patch
---

The Mermaid sequence writer writes an `autonumber` start that is not a finite number as plain `autonumber`, with a warning, so the file reads back.

<!-- entry: fix -->
