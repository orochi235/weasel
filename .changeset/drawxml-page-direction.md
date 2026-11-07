---
'@weasel-js/diagram-formats': patch
---

Draw-style XML keeps a graph page's `direction`, the way layout runs when the page is laid out again. It is written as a `weaselDirection` attribute on the page's graph model, which a draw app ignores, and read back from it. A value that is not a direction is dropped with a warning. DOT and Mermaid already carried the direction; draw-style XML used to lose it.
