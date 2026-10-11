---
'@weasel-js/storage': patch
---

`urlHashAdapter` survives a fragment that is not its own. A fragment decoding to JSON other than an object of strings (`null`, a number, an array) made every `get`, `list`, and `set` reject and the `hashchange` handler throw; it now reads as holding no records. Writes also keep `history.state` instead of replacing it with `null`, so a router's state survives a save.
