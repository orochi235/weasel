---
'@weasel-js/core': patch
---

The Direction leaf of a text node's properties offers Auto beside Left to right and Right to left, and reads a style with no direction as Auto, which is what the engine does with one. Before, such a style, and one holding `direction: 'auto'`, lit neither segment.
