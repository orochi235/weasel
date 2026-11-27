---
'@weasel-js/animator': minor
---

A nested timeline track takes a `window`, `[in, out)` in its parent's time, outside which none of its tracks is sampled and a `shown` target is held at 0 (1 inside), as a Lottie layer's in and out points do; a `Clip` carries both.

```ts
{ kind: 'timeline', at: 0, timeline, window: [500, 2000], shown: layerShown }
// in a Clip: { kind: 'timeline', at: 0, timeline, window: [500, 2000], shown: 'layer.shown' }
```

<!-- entry: new api -->
