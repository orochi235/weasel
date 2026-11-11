---
'@weasel-js/diagram-formats': patch
---

A Mermaid mind map is written so it reads back as the same tree.

Node lines are trimmed as the reader trims them; text that is blank, starts with `%%` or `:::`, or looks like an accessible title is quoted; brackets are spelled as entities; and an id that is not a plain name is renamed, as the flowchart renames one.

<!-- entry: fix -->
