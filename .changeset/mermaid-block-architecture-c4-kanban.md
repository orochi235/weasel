---
"@weasel-js/diagram-formats": patch
---

`DIAGRAM_MERMAID` reads and writes four more graph kinds, each into a page whose `notation` names it:

- `block-beta` (`'block'`): blocks in the flowchart's shapes, nested `block … end` groups as containers, and
  `columns`, spans, and `space`s as the options of the page's new `grid` layout, which the writer reads back.
- `architecture-beta` (`'architecture'`): services in their built-in icon's outline (`cloud`, `cylinder`, `disk`,
  `globe`, `server`), junctions as dots, groups as containers, sides as compass ports, and `{group}` ends on the
  group's box.
- `C4Context`, `C4Container`, `C4Component`, `C4Dynamic`, and `C4Deployment` (`'c4-context'` and so on): elements as
  boxes in their kind's outline and theme role, a first `<<kind>>` row naming the kind so it writes back, boundaries
  and deployment nodes as containers, and relationships labeled with their technology, their direction as ports.
- `kanban` (`'kanban'`): one pool of column lanes along `x`, each card a node in its lane, its metadata as `field`
  rows.

A graph page's `layout` can now name `grid`, with its `grid` option.
