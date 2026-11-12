---
'@weasel-js/svg': minor
---

`svgDraftSpecs` turns `svgNodesToKitDrafts`'s drafts into the node specs a scene adds. Poses come out local to their frames, and boolean groups rebuilt.

```ts
const drafts = svgNodesToKitDrafts(parseSvg(text), () => scene.mintId());
for (const spec of svgDraftSpecs(drafts, { layer: 'main', composition: scene.composition })) scene.add(spec);
```

<!-- entry: api -->
