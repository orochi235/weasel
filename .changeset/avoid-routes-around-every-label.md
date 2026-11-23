---
'@weasel-js/diagram': major
---

Avoid-routed connectors route around every label of another connector, its end labels as well as its middle one.

`AvoidEdge` takes `labels`, a list, in place of `label`; the router stations each on the connector's route.

```ts
// before
{ ...edge, label: { id, placement, size } }
// after
{ ...edge, labels: [{ id, placement, size }] }
```

<!-- entry: breaking api fix visual -->
