---
'@weasel-js/diagram-formats': patch
---

Imported and exported diagrams treat names like `constructor`, `toString` and `__proto__` as ordinary names.

A Mermaid block named `__proto__` keeps its span and space, as do a flowchart node's `@{ __proto__: … }` metadata and a C4 `$__proto__=` argument. A block or group named for an `Object.prototype` member no longer writes a `columns` line of function source, an outline so named no longer throws, and a class or ER edge end so named writes as an arrow or as exactly one.

<!-- entry: fix -->
