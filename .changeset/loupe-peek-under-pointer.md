---
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/labkit': patch
---

A key binding can now carry `opts: { over: true }`: it is live while the pointer is over its canvas, whichever canvas holds the keys, and only then. The loupe's peek key uses it, so with two loupes on a page the key peeks the one under the pointer rather than the one last pressed in, or none before anything was pressed. A `<LoupeGestures>` outside a camera now mounts its own input scope, so two of them under one provider no longer stack their actions on one id.
