---
"@weasel-js/diagram": patch
---

An item's `colors` holding a `__proto__` key, as `JSON.parse` reads one, stays a plain key of the style `diagramScene` draws it in. It was assigned, which set the style's prototype instead when the value was an object.
