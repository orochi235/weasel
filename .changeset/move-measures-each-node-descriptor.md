---
'@weasel-js/editing': patch
---

A move measures each node by its own pose descriptor when it carries a placed node's members along, reflows a layout's leftovers, picks the drop container, and catches a gliding node, so a node kind with a descriptor of its own lands with its members.

<!-- entry: fix -->
