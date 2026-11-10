---
"@weasel-js/devtools": patch
---

A devtools request whose transport throws on send rejects with that error and is forgotten, rather than staying pending until the connection closes.
