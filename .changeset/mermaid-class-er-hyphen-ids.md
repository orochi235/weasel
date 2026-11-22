---
'@weasel-js/diagram-formats': patch
---

Mermaid class and ER diagrams write ids holding hyphens, and namespaces holding dots, as they are, since their readers take them, rather than renaming them.

<!-- entry: fix -->
