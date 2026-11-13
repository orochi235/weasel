---
'@weasel-js/export': minor
---

New package: `@weasel-js/export` writes a page of any scene as SVG or PNG, and every page as one PDF, without `@weasel-js/diagram`.

`exportPageSvg`, `exportPagePng`, `exportPagesPdf` and `pageSvgNodes` take any scene with `RectPose`s and a page rect (a `PlacedPage` is one). By default they paint no background, since core holds no page color: pass `background` for one. The SVG writes a node a registered painter (`registerNodeShape`) claims from that painter's paths, and `painters` adds painters asked first, for kinds the scene may not have registered.

```ts
import { exportPagePng } from '@weasel-js/export';

const png = await exportPagePng(scene, placedPagesOf(scene)[0], { scale: 2, background: '#ffffff' });
```

<!-- entry: rank=10 new api -->
