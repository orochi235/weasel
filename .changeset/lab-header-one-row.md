---
'@weasel-js/labkit': patch
---

A lab's header stays one row at every width, its menus beside the title as in an app's title bar. A narrow header
truncates the title, and add trial, zoom and the theme switch give way to the Lab and View menus that also hold
them, rather than wrapping onto a second row. A lab drawn with `menuBar={false}` keeps all three.
