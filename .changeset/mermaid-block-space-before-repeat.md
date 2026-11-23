---
'@weasel-js/diagram-formats': patch
---

Reading a Mermaid block diagram keeps a `space` before a block mentioned again, placing it before the next new block.

It had been dropped on a line of blocks; a line of links already kept it, as Mermaid does.

<!-- entry: fix -->
