---
'@weasel-js/labkit': patch
---

A `LensCapture`'s bitmap belongs to the lens source that gave it, and is good only until that source's next capture for the same lens side.

A caller that paints the capture as soon as it resolves needs no change. One that keeps it longer, across an `await`, in state, or for a later frame, must now copy it and close its copy:

```ts
const got = await source.capture(request);
if (!('reason' in got)) {
  const mine = await createImageBitmap(got.bitmap);
  // ...use `mine` later, then
  mine.close();
}
```

The Difference view now copies its two captures as they land.

<!-- entry: behavior -->
