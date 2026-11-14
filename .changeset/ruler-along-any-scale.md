---
'@weasel-js/ui': major
---

`Ruler` is a ruler along any continuous scale, with `RulerMark` for points on it; the time ruler it used to name is `TimeRuler`.

`TimeRuler` takes the props `Ruler` took. The new `Ruler` takes a `scale` onto `[0, 1]` and either a list of ticks or the spacing to place them at, and hides the tick labels that would crowd, keeping each notch. A `RulerMark` child's label is always shown.

```tsx
// before
<Ruler window={win} bounds={bounds} playhead={t} onScrub={setT} onWindowChange={setWin} />
// after
<TimeRuler window={win} bounds={bounds} playhead={t} onScrub={setT} onWindowChange={setWin} />

// a ruler of your own
<Ruler scale={linearScale({ domain: [0, 250], range: [0, 1] })} ticks={{ minSpacing: 48 }}>
  <RulerMark at={120} label="here" />
</Ruler>
```

<!-- entry: rank=5 breaking new api -->
