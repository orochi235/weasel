---
'@weasel-js/loupe': minor
'@weasel-js/hud': minor
---

A loupe can pin its aim to a spot on the canvas, held there as the view pans and zooms.

The ring around a `createLoupe` lens carries a pin: drag it onto the canvas to pin the aim where it drops, drag the
dashed target circle to move it, drag it back onto the lens or click the pin to let the aim follow the pointer again.
While the ring shows, a dashed line runs from the pin to its target.

```ts
loupe.pinAt({ x, y });          // screen point; held as the world point under it
loupe.setAimMode('follow');     // or 'pinned', at the aim now
createLoupe({ ..., aimMode: 'pinned', pinIcon: icon('ui:pin'), camera: api.getView, onAimModeChange });
```

`LoupeSurface` takes optional `worldAt` and `pointFor` to hold a pin in content space, and `LoupeModel` gains
`aimMode`, `setAimMode` and `pinAt`. `useLoupe` passes the canvas's camera, and takes `pinIcon` in its settings and
`onAimModeChange` in its events.

<!-- entry: new api -->
