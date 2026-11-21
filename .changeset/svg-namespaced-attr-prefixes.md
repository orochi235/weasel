---
'@weasel-js/svg': patch
---

A namespaced element kept through SVG import keeps `id` and `foo:id` as two attributes, writing each back under its own name.

An attribute of it in an undeclared namespace, such as `xlink:href`, is dropped, as an undeclared child element already was.

<!-- entry: fix data -->
