---
'@weasel-js/diagram': patch
---

Org chart and mind map diagram types. `radial` is a new layout in `LAYOUTS`: the first root sits in the middle, its branches are dealt right and left in graph order to keep the two sides balanced by node count, and each side grows away from the root as a horizontal tree whose subtrees never interleave; further trees stack below, and a second run moves nothing. `subtreeBlocks`, the block packing `tree` and `radial` share, is exported for layouts of your own.

`STENCIL_GROUPS` gains `org` (`ORG_STENCILS`: person, executive, and assistant cards, each a name over a title, and a department box) and `mindMap` (`MIND_MAP_STENCILS`: central topic, main topic, subtopic, and a floating note), each with palette glyphs. `DIAGRAM_TYPES` gains `orgChart` (org cards and containers, unmarked orthogonal connectors, laid out with `tree`) and `mindMap` (unmarked curved connectors, laid out with `radial`), also exported as `ORG_CHART_TYPE` and `MIND_MAP_TYPE`.
