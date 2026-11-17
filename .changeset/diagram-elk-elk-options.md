---
'@weasel-js/diagram-elk': major
---

Raw ELK options go in `elkOptions`, so they no longer share a name with the layout options the type extends.

`ElkLayoutOptions.layoutOptions` is renamed `elkOptions`; its values are unchanged.

```ts
// before
await elkPlan(graph, { layoutOptions: { 'elk.algorithm': 'mrtree' } });
// after
await elkPlan(graph, { elkOptions: { 'elk.algorithm': 'mrtree' } });
```

<!-- entry: breaking api -->
