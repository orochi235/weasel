---
'@weasel-js/diagram': patch
---

Effect charts treat stage ids, port ids and value types like `constructor`, `toString` and `__proto__` as ordinary names.

A stage with the id `__proto__` now plans its audio node, keeps its place when moved, and records its values and previews. A stage named for an `Object.prototype` member counts as unreached when the run never reached it, and a value type so named gets a series color instead of a function. A document's places, routes, labels and group boxes no longer find built-ins for such ids.

<!-- entry: fix -->
