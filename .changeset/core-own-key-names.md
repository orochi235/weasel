---
'@weasel-js/core': patch
---

Names like `toString` or `__proto__` in rigs, layers, tool ids, insert kinds and node-function keys no longer resolve to built-ins.

A skin joint, layer slot or preset tool named `__proto__` is kept as an entry rather than replacing the object's prototype, a node-function key `toString` in a snapshot restores no function, `insertBuilds('constructor')` is false, `shapeKindInfo('toString')` is undefined, and a pose compares unequal to one lacking a field named for an `Object.prototype` member.

<!-- entry: fix -->
