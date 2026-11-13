---
'@weasel-js/diagram': minor
---

`useDiagramTools` builds every tool diagram ships, and the `DIAGRAM_TOOLS` set names them.

That is the connector, a tool per stencil and the sequence tools; `STENCIL_TOOLS` holds one set per stencil group.

`stencilTools(stencils)` keys a tool per stencil by its insert kind, and `stencilToolSet(group)` names a group's.

```tsx
const tools = useDiagramTools({ connector: { participants }, sequence: { commit } });
<SceneCanvas tools={tools} … />
```

<!-- entry: api new -->
