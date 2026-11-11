---
'@weasel-js/diagram-formats': patch
---

A Mermaid timeline reads back as written, `#` and numbered references included. A period named `title …`, `section …` or `%%…` stays a period.

A period with no label is written as `(untitled)`, with a warning, keeping it and its events.

<!-- entry: fix -->
