---
'@weasel-js/quantity': patch
'@weasel-js/core': patch
---

Adds API: arithmetic across units. `resolveUnitExpr('50% + 2ft', { unitSystem, percentOf })` returns base units, and `parseUnitExpr` returns the expression as plain data (`UnitExpr`), so a stored one resolves again when the length its percentage is measured against changes. It reads `+ - * /`, parentheses, and adjacent terms as one compound value (`5ft 3in`). Both are re-exported from `@weasel-js/core`.

Decided on an agent's judgment: a bare number beside `+` or `-` is base units and beside `*` or `/` a scalar; a measure over a measure is a scalar; a product of two measures, a scalar over a measure, and a unit with an offset (degC) anywhere inside arithmetic all throw; `%` resolves against `percentOf` unless the unit system defines a `%` unit of its own.
