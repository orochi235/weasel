---
'@weasel-js/core': patch
---

A gesture's `GestureContext` carries the canvas's kit settings as `kitSettings`, so a behavior can read a setting at the moment it uses one; move, resize, rotate, insert, and clone now ask for the `kitSettings` dep to fill it.
