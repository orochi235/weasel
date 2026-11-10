---
'@weasel-js/diagram-formats': patch
---

A Mermaid timeline reads back as it was written: a `#` is written as `#35;` and the reader reads Mermaid's numbered references (`#58;` and the rest), so text holding `#58;` keeps it; a period labeled `title …`, `section …`, or `%%…` no longer reads as a title, a section, or a comment; and a period with no label is dropped with a warning, where it was written as a line that added its events to the period above, or failed to read.
