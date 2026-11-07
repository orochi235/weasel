---
'@weasel-js/diagram-formats': patch
---

Writing a Mermaid flowchart, a dashed edge whose dash is not the one a dotted link draws gets a `stroke-dasharray` in its `linkStyle`, as a node's dash already did, so it reads back with its own dash rather than the dotted link's.
