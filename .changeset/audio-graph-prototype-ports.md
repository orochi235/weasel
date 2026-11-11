---
"@weasel-js/audio": patch
---

An audio graph node's ports are held without a prototype, so a port named like an `Object.prototype` member is a port like any other. Replacing a node with a def whose port was `toString` or `constructor` threw a `TypeError`, and a port named `__proto__` could not be connected to.
