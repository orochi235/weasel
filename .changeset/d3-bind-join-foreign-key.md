---
"@weasel-js/d3": patch
---

`d3Bind`'s `join` refuses a key the scene gives to anything but a mark on the binding's layer. Its error names both, and it changes nothing first.

<!-- entry: fix -->
