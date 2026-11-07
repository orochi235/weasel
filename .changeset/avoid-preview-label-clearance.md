---
'@weasel-js/diagram': patch
---

During a drag, the `avoid` router's previews kept connectors `clearance` away from other connectors' labels rather than `labelClearance`, so a connector that passed close by a label detoured while the drag ran and jumped back when it ended.
