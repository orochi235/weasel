---
'@weasel-js/diagram': patch
---

`edgeIdOf` tells an empty-string port or label apart from none: `{ from: 'a', fromPort: '', to: 'b' }` is `edge:a.->b`, no longer `edge:a->b`, and an empty label adds a trailing `:`. Two such edges used to share an id, so `diagramScene` drew only the first.
