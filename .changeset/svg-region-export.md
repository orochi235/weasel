---
'@weasel-js/svg': minor
---

`exportRegionSvg` writes any region of a scene as an SVG document, and `registerSvgExport()` makes it core's `svg` export format.

It draws a node a consumer painter claims (`painters`, else `registerNodeShape`) from that painter's paths, and a node that derives its path along it. `text` sets how text is written: `'live'` (the default), `'outline'` or `'embed'`. `title` defaults to the region's `name`, and no background is painted unless given. `regionSvgNodes` is the walk alone.

```ts
registerSvgExport();
const blob = await exportRegions(scene, [region], 'svg', { background: '#ffffff' });
```

<!-- entry: rank=5 new api -->
