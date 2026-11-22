---
'@weasel-js/diagram-formats': patch
---

Reading Mermaid throws on an `accTitle { … }` block, naming its line. Mermaid reads only `accDescr` as a block; this was taken as the accessible description.

<!-- entry: fix -->
