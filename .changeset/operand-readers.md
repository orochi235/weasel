---
'@weasel-js/core': major
---

`selectedPathNodes` is `operandPathNodes`, since it reads the `operands` dep, which a host can fill from something other than the selection.

```ts
// before
const paths = selectedPathNodes(deps);
// after
const paths = operandPathNodes(deps);
```

<!-- entry: breaking api -->
