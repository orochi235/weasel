---
"@weasel-js/diagram-formats": patch
---

`@weasel-js/diagram-formats` reads and writes Mermaid flowcharts (`DIAGRAM_MERMAID`, `.mmd` and
`.mermaid`) and Graphviz DOT graphs (`DIAGRAM_DOT`, `.dot` and `.gv`), both listed in
`DIAGRAM_FORMATS`. Each file is one page: shapes, labeled connectors, subgraphs or clusters as
containers, the page's direction, and colors from Mermaid's `classDef`, `class`, `style`, and
`linkStyle` or DOT's `fillcolor`, `color`, and `fontcolor`. Neither holds places, except DOT when
every node has a `pos`, so a read page is laid out once on import. Writing takes the page
`WriteOptions.page` names. Both read with hand-written parsers that name the line of a syntax
error, and both warn for what they drop either way: unknown shapes, attributes and statements a
diagram does not hold, pools and lanes written as nested clusters, connectors to other pages.
