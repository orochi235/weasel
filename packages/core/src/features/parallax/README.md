# parallax

Multi-plane parallax: render the same layers through *derived* views so
background planes move less than the camera and foreground planes move more.

The math is pure and lives in `core/viewport/parallax.ts`; this folder holds
the layer wrapper and the live plane.

## `deriveParallaxView(outer, opts)`

Pure. Takes the camera `View` and per-plane factors, returns the plane's inner
`View`. No state, no side effects — trivially testable, and reusable anywhere
you need "a view that tracks the camera at a fraction."

| Option | Meaning |
| --- | --- |
| `pan` | How much the plane translates with the camera. `1` = normal, `0` = locked to `anchor`, `>1` = leads the camera. |
| `zoom` | How much it scales with camera zoom. `1` = normal, `0` = fixed at identity scale. |
| `anchor` | The camera position at which every plane lines up. Defaults to the origin. |

Both `pan` and `zoom` take a scalar or `{x, y}`, so you can parallax one axis
only — common for side-scrolling backdrops.

**Identity holds:** `pan: 1, zoom: 1` returns a view equal to `outer`. That's
the invariant to preserve if you touch the math; a plane at defaults must be
pixel-identical to no parallax at all.

## `planeMap(outer, opts)`

The same plane as an axis-aligned map from the camera's world into the plane's
(`toPlane` / `fromPlane`, `rectToPlane` / `rectFromPlane`): the two points it
pairs sit under the same pixel. It is how a pointer, a marquee or a selection
box crosses between the camera and a plane.

## Two kinds of plane

| | Paint | Scene nodes |
| --- | --- | --- |
| Declared by | `createParallaxLayer({ source, parallax })` | `parallax` on a scene layer (`systemLayers`, `addLayer`, `setLayerParallax`) |
| Draws | any render layers | the layer's nodes, through `<SceneCanvas>`'s scene walk |
| Clickable | no | yes — picking, marquee, lasso and selection chrome go through the plane |
| Changed live by | a `ParallaxPlane` (`createParallaxPlane`) passed as `parallax` | `scene.setLayerParallax`, inside `scene.untracked` when animating |

Editing a node on a plane — move, resize, rotate, clone, insert, anchor edits,
snapping — goes through the plane too (`inPlane`,
`interactions/actions/planeInput.ts`), including a selection that spans planes
and a drop into a container on another plane.

## Animating a plane

A plane's opts are values an animator drives: tween a number and write it in
`onTick`.

```ts
const plane = createParallaxPlane({ pan: 0.4 });
animator.tween({ from: -1200, to: 0, ms: 1400, onTick: (x) => plane.set({ anchor: { x, y: 0 } }) });
// A scene layer: untracked, so no frame becomes an undo step.
animator.tween({ from: 0, to: 0.4, ms: 800, onTick: (pan) =>
  scene.untracked(() => scene.setLayerParallax('hills', { pan })) });
```

## Picking `anchor`

`anchor` is a camera position — the view's `x`/`y`, its top-left in world
units — and every plane lines up exactly when the camera sits there. Put it
where the composition should read as registered, usually the camera's starting
position. Tweening it is how the demo's intro throws the planes apart and
settles them.
