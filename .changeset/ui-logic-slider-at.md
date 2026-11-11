---
"@weasel-js/ui-logic": patch
---

`@weasel-js/ui-logic` exports `sliderAt`, the value a pointer picks along a slider's track.

`sliderAt(f, shape)` reads the track at fraction `f`, lands on the step grid inside `min` to `max`, and is pulled onto a stop within `pull` unless `free`.

The shape carries a `TrackMap` (`toFraction` and `toValue`), so the same rule reads a linear track, a scaled one, or a window onto a longer range. `evenMap(stops)` is the map for a track its stops divide evenly.

```ts
sliderAt(0.42, { min: 0, max: 100, stops: [40, 80], pull: 0.03, ...spanMap({ from: 0, to: 100 }) }); // 40
```

<!-- entry: new api -->
