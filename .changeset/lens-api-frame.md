---
'@weasel-js/labkit': minor
'@weasel-js/forge': patch
---

Lenses in a lab embedded under a host's surface are placed, followed and read back where the lens canvas draws them.

`createLensApi` takes a `frame` ref, the element whose px the lens scene holds, and `useLabBody` returns one as `frameRef`: the surface container the lens canvas covers. Pass it as `frame`, and to `lensClient` in place of the body.

```ts
const { bodyRef, frameRef, pointer } = useLabBody();
createLensApi(scene, { body: bodyRef, frame: frameRef, pointer, focus, sources });
```

<!-- entry: fix api -->
