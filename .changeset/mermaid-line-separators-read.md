---
'@weasel-js/diagram-formats': patch
---

Mermaid readers read a line or paragraph separator (U+2028, U+2029) inside a statement as text instead of throwing or cutting a title at it.

<!-- entry: rank=-5 fix -->
