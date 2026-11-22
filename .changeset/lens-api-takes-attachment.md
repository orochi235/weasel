---
'@weasel-js/labkit': minor
---

`createLensApi` and `lensClient` take the overlay's `LensAttachment`, so lenses on a zoomed or panned pane land under the pointer.

```ts
const api = createLensApi(scene, { body, frame, attachment: paneCamera, pointer, focus, sources });
const at = lensClient(scene, lensId, frame.current, paneCamera);
```

<!-- entry: api fix -->
