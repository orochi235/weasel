---
'@weasel-js/labkit': patch
---

A lab given two instruments with one name throws, naming it, instead of rendering with one and saving with the other.

`createLabStore({ instruments })`, `setInstruments` and `<Lab instruments>` used to accept such a list silently; they now throw. Give each instrument its own `name`.

<!-- entry: fix behavior -->
