---
'@weasel-js/diagram-formats': patch
---

Reading a Mermaid flowchart, a link's quoted inline text may hold an arrow, as in `A -- "a --> b" --> B`. The arrow inside the quotes used to end the text there, and the reader then threw on the closing quote.
