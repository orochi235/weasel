---
'@weasel-js/ui': major
---

`PointPlotter` is gone; spread `POINT_PLOTTER_PROPS` into a `CurveEditor` for the same plot.

The preset sets `curve: false`, `fill: false`, `endpoints: 'free'` and `addPointMode: 'click-empty'`, and is exported from `@weasel-js/ui/components/CurveEditor`. Props written after the spread win, so `addPointMode="never"` still turns insertion off.

```tsx
// before
<PointPlotter value={points} onInput={setPoints} width={400} height={200} />
// after
<CurveEditor {...POINT_PLOTTER_PROPS} value={points} onInput={setPoints} width={400} height={200} />
```

<!-- entry: breaking api -->
