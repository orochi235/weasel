---
'@weasel-js/ui': patch
---

In a `createKeyframeLayer` layer, an arrow key that moved the focused key past its neighbor left focus on the neighbor, so the next press moved a different key. Focus now follows the key it was moving.
