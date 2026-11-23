---
'@weasel-js/icons-plugin': patch
---

A call to a local `icon` that `import icon = …` binds inside a namespace is left as written, not rewritten as an imported `icon()` call.

<!-- entry: fix -->
