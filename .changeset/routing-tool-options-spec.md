---
'@weasel-js/routing': major
'@weasel-js/core': major
---

The type a tool declares its options with is `ToolOptionsSpec`, since it is a declaration of the options rather than a bag of their values.

`ToolOptions` (routing, re-exported by core) is renamed `ToolOptionsSpec`; its fields are unchanged.

```ts
// before
export const LASSO_TOOL_OPTIONS: ToolOptions = { actionId: 'lasso', prefs };
// after
export const LASSO_TOOL_OPTIONS: ToolOptionsSpec = { actionId: 'lasso', prefs };
```

<!-- entry: breaking api -->
