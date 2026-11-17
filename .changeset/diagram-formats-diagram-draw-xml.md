---
'@weasel-js/diagram-formats': major
---

The draw-style XML format is `DIAGRAM_DRAW_XML`, beside `DIAGRAM_JSON`, `DIAGRAM_MERMAID` and `DIAGRAM_DOT`.

`DRAW_XML` is renamed `DIAGRAM_DRAW_XML`; the format is unchanged.

```ts
// before
const { document } = await DRAW_XML.read!(text);
// after
const { document } = await DIAGRAM_DRAW_XML.read!(text);
```

<!-- entry: breaking api -->
