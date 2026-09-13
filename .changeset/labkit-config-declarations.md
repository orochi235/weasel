---
'@weasel-js/labkit': patch
---

Exported config schemas now emit declarations. The `f.*` builder node classes (`BaseNode`, `NumberNode`, `BooleanNode`, `StringNode`, `ColorNode`, `EnumNode`, `ValueNode`, `CustomNode`, `GroupNode`) are exported as values from `@weasel-js/labkit` and `@weasel-js/labkit/config`, so a declaration can name them and a consumer can extend them.
