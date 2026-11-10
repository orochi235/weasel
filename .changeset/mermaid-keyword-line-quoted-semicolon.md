---
'@weasel-js/diagram-formats': patch
---

A Mermaid flowchart keyword line (`subgraph`, `click`, `style`, …) ends at a `;` outside quotes only, so a quoted
subgraph title holding a character reference such as `#quot;` reads back as written instead of failing.
