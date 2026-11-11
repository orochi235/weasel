---
'@weasel-js/diagram-formats': patch
---

A Mermaid flowchart keyword line (`subgraph`, `click`, `style`, …) ends at a `;` outside quotes only, so a quoted title holding `#quot;` reads back.

<!-- entry: rank=-5 fix -->
