---
'@weasel-js/diagram': major
---

`DiagramData.groups` is `DiagramData.clusters`.

```ts
// before
diagramScene({ nodes, edges, groups: [{ id: 'ingest', members: ['fetch', 'decode'] }] });
// after
diagramScene({ nodes, edges, clusters: [{ id: 'ingest', members: ['fetch', 'decode'] }] });
```

Data still holding `groups` draws no boxes. A Diagram JSON file written under the old name still loads: `@weasel-js/diagram-formats` reads it as `clusters`.

<!-- entry: rank=5 breaking api data -->
