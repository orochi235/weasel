---
'@weasel-js/dither': major
'@weasel-js/p-touch': major
---

dither's option types are named for the function they configure.

`ditherPixels` takes `DitherPixelsOptions` (formerly `DitherOptions`), and `dither` takes `DitherOptions` (formerly `GpuDitherOptions`).

```ts
// before
const cpu: DitherOptions = { method: 'atkinson' };
const gpu: GpuDitherOptions = { method: 'bayer' };
// after
const cpu: DitherPixelsOptions = { method: 'atkinson' };
const gpu: DitherOptions = { method: 'bayer' };
```

<!-- entry: breaking api -->
