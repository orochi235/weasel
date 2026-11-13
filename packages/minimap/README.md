# @weasel-js/minimap

A minimap with linked cursors, in two forms that share one set of actions.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/minimap).

```sh
npm install @weasel-js/minimap
```

| Form | Where it paints | Install |
|---|---|---|
| `createMinimapContribution({ rect, fit })` | A `<CanvasView>` on the main canvas's own surface | One `ambient` entry |
| `<MinimapCanvas>` | A canvas of its own | A component beside the main canvas |

## The contribution

It is the worked example of a `SurfaceContribution` that uses every role:

| Role | What it holds |
|---|---|
| `views` | The minimap: a `<CanvasView>` at `rect`, its camera a fit over the scene |
| `actions` | `minimap.center` (press) and `minimap.pan` (drag), which move `rootView`; and, unless `zoom: false`, `minimap.zoom` (wheel and trackpad pinch), which zooms it about the point under the cursor, and `minimap.pinch` (two-finger touch pinch), which zooms it about the point between the fingers |
| `bindings` | `pointerDown`, `drag`, `wheel`, `pinch` and `multiTouch`, scoped with `views: [id]` so they outrank the active tool inside the minimap and never fire outside it |
| `overlay` | The visible-rect indicator, painted only in the minimap; the linked crosshair, painted in whichever view the pointer is not over |
| `attach` | Reads the `scene` and `pointer` deps, and repaints while the crosshair shows |

Build it once (`useMemo`, or module scope): each instance keeps the live state
its layers read, and `attach` runs once per instance.

## The detached form

`<MinimapCanvas>` runs the same actions on a dispatcher of its own, bound
unscoped since that dispatcher routes no views, with `rootView` answering the
`mainView` / `onMainViewChange` props and `view` answering the minimap's fit
camera, as it does inside the contribution's view. Give `zoom` the main view's
`{ min, max }` when they differ from the kit defaults, or `false` to leave the
wheel to the page. Put one `<PointerContextProvider>`
around it and the main canvas, and give the main canvas
`createLinkedCursorContribution()`, for crosshairs in both directions.

## Why `rootView`

Inside the minimap's view, the `view` dep answers the minimap's camera — that
is what lets every other action work in a view. An action there that must move
the main camera reads `rootView`, never `view`; `viewport.dragPan` reads `view`
and so pans whichever view the drag lands in. `minimap.pinch` reads both: `view`
to find the world point between the fingers, `rootView` to zoom about it.

A secondary view with a dispatcher of its own answers the same pair: its own
camera as `view` and the camera it steers as `rootView`, which is what
`<MinimapCanvas>` does. An action written against them runs unchanged in
either host.
