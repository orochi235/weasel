---
'@weasel-js/diagram-formats': patch
---

Mermaid class and ER diagrams write ids holding hyphens, and namespaces holding dots, as they are. Their readers take them, so they read back unrenamed.

<!-- entry: fix -->
