---
'@weasel-js/diagram-formats': patch
---

Mermaid writers no longer write lines their readers refuse or misread. An ER row that is not a type and a name, a class member that is blank or a lone `}`, and a blank line past a state's name are dropped, with a warning. A mind map node's lines are trimmed as the reader trims them, so leading whitespace no longer moves the node in the tree; text that is blank, starts with `%%` or `:::`, or looks like an accessible title is written quoted; brackets are spelled as entities, and an id that is not a plain name is renamed, as the flowchart renames one.
