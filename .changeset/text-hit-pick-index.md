---
'@weasel-js/core': patch
---

A double-click that opens a text edit finds its node through the scene's pick index once the index is current, rather than testing every node in the scene. It answers the same node and caret as before.
