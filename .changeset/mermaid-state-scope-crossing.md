---
'@weasel-js/diagram-formats': patch
---

No state moves into a composite when a Mermaid state diagram reads back. The writer drops a transition joining a composite's `[*]` to a state outside it, with a warning.

<!-- entry: fix data -->
