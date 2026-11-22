---
'@weasel-js/diagram': minor
---

The add-lane button can color a new lane by the pool's lane bodies in a scene with no diagram theme.

Pass `createDiagramContainersContribution` the same `laneStyles` given `containerBuild`:

```ts
createDiagramContainersContribution({ scene, laneStyles: { bodies } });
```

<!-- entry: api fix -->
