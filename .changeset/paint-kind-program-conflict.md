---
'@weasel-js/renderer': patch
---

A paint kind declaring a program that `registerProgram` holds with other source throws `ExtensionConflictError`.

It no longer replaces that program, or deletes it when the kind is disposed.

<!-- entry: fix -->
