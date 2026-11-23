---
'@weasel-js/diagram-formats': patch
---

Reading a Mermaid block diagram gives `classDef default` to blocks only, not to the groups around them, as a flowchart leaves it off subgraphs.

<!-- entry: fix visual -->
