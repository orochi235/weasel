---
'@weasel-js/diagram-formats': patch
---

The Mermaid state writer drops a transition joining a composite's `[*]` to a state outside it, with a warning, so no state moves into the composite when read back.

<!-- entry: fix data -->
