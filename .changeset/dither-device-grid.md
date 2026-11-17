---
'@weasel-js/dither': major
---

`gridOnScreen` is renamed `deviceGrid`: it places an output grid in device pixels of the drawing buffer, and returns a `DeviceGrid`.

```ts
// before
dither({ method: 'bayer', grid: gridOnScreen(grid, view, dims.dpr) });
// after
dither({ method: 'bayer', grid: deviceGrid(grid, view, dims.dpr) });
```

<!-- entry: breaking api -->
