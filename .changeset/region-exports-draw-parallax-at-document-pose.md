---
'@weasel-js/core': major
'@weasel-js/pdf': major
---

PNG, PDF and SVG exports and `renderSceneToPixels` draw a parallax layer at its document pose, at any scale.

Parallax is the camera's, and a render with no camera has none. To capture what a view shows, planes and all, pass that view as the new `camera`; `scale` then changes only the resolution. `renderDebugSnapshot` does this itself.

```ts
// before: planes followed the output's own view, moving with the region and the scale
renderSceneToPixels({ scene, sourceRect: viewportWorldRect(view, size), scale });
// after
renderSceneToPixels({ scene, sourceRect: viewportWorldRect(view, size), scale, camera: view });
```

<!-- entry: rank=5 breaking behavior api fix visual -->
