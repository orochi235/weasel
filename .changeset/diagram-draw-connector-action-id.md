---
'@weasel-js/diagram': major
---

The connector tool's drag action is `diagram.drawConnector` (`DRAW_CONNECTOR_ACTION_ID`), verb first like the other action ids.

`CONNECTOR_ACTION_ID` (`'diagram.connectorDraw'`) is renamed `DRAW_CONNECTOR_ACTION_ID` (`'diagram.drawConnector'`).

```ts
// before
bindings: [{ spec: { kind: 'drag' }, actionId: CONNECTOR_ACTION_ID }], // 'diagram.connectorDraw'
// after
bindings: [{ spec: { kind: 'drag' }, actionId: DRAW_CONNECTOR_ACTION_ID }], // 'diagram.drawConnector'
```

<!-- entry: breaking api -->
