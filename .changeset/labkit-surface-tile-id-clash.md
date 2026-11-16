---
'@weasel-js/labkit': patch
---

Registering a surface tile, painter or clear under an id a live registrant still holds throws, naming the id.

A tile counts as live while its element is in the document; a painter or clear until its release runs. Code that used to register two under one id, such as two `useSurfaceTile('plot')` calls in one trial, now throws; give each its own id.

<!-- entry: fix behavior -->
