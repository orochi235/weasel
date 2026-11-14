---
'@weasel-js/ui': major
---

`CurveEditor` and `PointPlotter` take what they draw under the curve as children, and their `decorations` prop is gone.

The children may be plain SVG or more curve layers, which a press reaches after the editor's own curve.

```tsx
// before
<CurveEditor value={points} onInput={setPoints} width={200} height={100} decorations={<line x1={0} x2={200} y1={50} y2={50} />} />
// after
<CurveEditor value={points} onInput={setPoints} width={200} height={100}>
  <line x1={0} x2={200} y1={50} y2={50} />
</CurveEditor>
```

<!-- entry: breaking api -->
