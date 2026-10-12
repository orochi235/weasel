---
'@weasel-js/quantity': patch
'@weasel-js/core': patch
---

Adds API: a unit system nested in another. A `UnitScope` is a `UnitSystem` plus the `scale` one of its base units is worth in the scope around it, so a sub-assembly drawn in millimeters can sit in a scene measured in inches. `resolveScoped(value, scopes)` reads a value against the innermost scope and returns the outermost scope's base units, converting at each boundary; `toRoot` and `fromRoot` convert a bare measure each way; `formatScoped` writes a root measure in an inner unit; and `scopesOf(id, root, tree)` collects the chain for a node from a `parentOf` and a `scopeOf`. All are re-exported from `@weasel-js/core`.

Decided on an agent's judgment: a value is resolved only against the innermost scope's units, so `ft` inside a metric scope throws; and a node's own scope covers its children, not the node, unless `scopesOf` is asked to be `inclusive`.
