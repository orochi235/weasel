---
'@weasel-js/hud': minor
---

A HUD window can be round: `shape: 'round'` makes it a circle that clips its content and resizes from its rim.

It sits in square bounds, takes presses only inside the circle, and a rim drag keeps it square.

```ts
hud.window({ id: 'lens', title: 'Lens', shape: 'round', x: 24, y: 24, width: 200, height: 200, content });
```

A round window is always bare. A `'pass'` interior is ringed by a grip band that moves it. A widget declares `shape: 'round'` to have its content clipped and its focus ring drawn round.

<!-- entry: rank=5 new api -->
