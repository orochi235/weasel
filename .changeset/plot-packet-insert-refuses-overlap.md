---
'@weasel-js/plot': patch
---

`insertPacketField` throws on a field that starts inside the field before it, as `setPacketStart` does, so a packet's fields never overlap.

<!-- entry: fix behavior -->
