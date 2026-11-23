---
'@weasel-js/diagram-formats': patch
---

Reading a Mermaid architecture diagram whose groups nest in a loop throws "group … would hold itself", rather than hanging, whichever group is read first.

<!-- entry: fix -->
