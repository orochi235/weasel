---
'@weasel-js/diagram-formats': patch
---

Mermaid flowcharts read and write edge ids (`A e1@--> B`), the syntax Mermaid 11 added. Reading one used to throw. The id becomes the edge's id. A link joining several nodes (`A & B e1@--> C`) gives it to its first edge only. An `e1@{ … }` line naming an edge is dropped with a warning rather than read as a node. Writing, an edge's id is written only where reading the file back would not give the edge that id anyway and where Mermaid can hold the id as it is, so `a --> b` with id `a-b` stays as it was. A graph page's reader now keeps an edge id it was given, if no other item holds it, instead of always minting `from-to`.
