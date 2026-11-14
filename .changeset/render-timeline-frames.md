---
'@weasel-js/core': minor
---

`renderTimelineFrames` renders a timeline span to a sequence of rasters at a frame rate, for saving an animation as images.

```ts
for await (const frame of renderTimelineFrames({ timeline, fps: 30, render: { scene, sourceRect, scale } })) {
  pngs.push(await rasterToPng(frame.image));
}
```

It pauses the timeline, seeks each frame in order and renders it through one raster session (`session` to bring your own), and puts the timeline back where it was, playing or paused, when it ends. `from` and `to` choose the span in ms (default the whole timeline); frames cover `[from, to)` unless `includeEnd`. `signal` cancels before the next frame and `onProgress` reports each one. `timelineFrameTimes` answers the playheads alone.

<!-- entry: rank=5 api new -->
