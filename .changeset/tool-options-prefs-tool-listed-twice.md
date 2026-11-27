---
'@weasel-js/routing': patch
---

`toolOptionsPrefs` places a tool listed twice (in a registry and among the ambient tools) once, where it used to throw that the tool's options and a tool under it would share one place; two different tools of one id with different options now throw saying so.

<!-- entry: fix -->
