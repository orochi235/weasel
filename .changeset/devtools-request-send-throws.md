---
"@weasel-js/devtools": patch
---

A devtools request whose transport throws on send rejects with that error and is forgotten. It no longer stays pending until the connection closes.

<!-- entry: rank=-5 fix -->
