---
'@weasel-js/diagram': major
---

diagram's tool factories are `createConnectorTool` and `createStencilTool`, paired with `useConnectorTool` and `useStencilTool`.

This is a breaking rename: `connectorTool` and `stencilTool` are gone, with no alias. Their arguments are unchanged.

```ts
// before
const tool = stencilTool(FLOWCHART_STENCILS[0]);
// after
const tool = createStencilTool(FLOWCHART_STENCILS[0]);
```

<!-- entry: breaking api -->
