---
'@weasel-js/diagram': patch
---

`diagram.layout` is disabled when the layout would move nothing: an empty diagram, one already laid out, or one whose participants are all locked.

The layout runs once per change to the scene or its source, however often `enabled` is asked, and the run after it writes that same answer.

<!-- entry: behavior -->
