# viewports

`@experimental`

A **viewport node** is a screen-space rectangle on the outer canvas that
re-renders one or more source layers through an *inner* `View`, then clips them
to its rect.

Use cases: picture-in-picture, minimap, scrolling container, multi-angle
preview.

## Routing input

`createViewResolver` answers which view owns a client point, and holds a
captured pointer on the view its gesture started in — a drag that wanders out of
its rect keeps reporting coordinates in the space it began in. It routes any
`ResolvableView` (a camera plus the rect it paints into), which a viewport node
supplies via `resolvable(outer, dims)`.

Its `ViewTarget.origin` is the client-space origin of the resolved view, so
`clientToWorld(x, y, target.origin, target.view)` lands in that view's world.

`<CanvasView>` wires all of this: it contributes a viewport node and a dispatch
record, and `<SceneCanvas>` routes events between them. Reach for the module
directly when you want a viewport the canvas does not route input to — a
minimap, a magnifier — or when you are building your own routing.

## Viewports are lenses, not copies

The same source layer can be rendered through several viewports with different
inner views **without duplicating the data**. A viewport doesn't own content;
it owns a view onto content that lives elsewhere. Adding a second viewport onto
the same layers costs another draw pass, not another copy of the scene.

## Per-view data

Source layers get the outer canvas's `data` by default. A `data` thunk on the
opts derives what they see instead — which is how a viewport showing the same
scene through a second camera gives its layers their own selection, chrome state
and gesture previews rather than the hosting view's.

## Inner view semantics

Source layers draw as if the inner view were the camera — they can't tell
they're inside a viewport. That's the property that makes arbitrary layers
reusable here, and it's the one to preserve: a layer that reaches for the
outer/camera view directly instead of the view it's handed will render wrong
inside a viewport, and the bug won't show up until someone puts it in one.

## Related

- [`../parallax`](../parallax/README.md) also derives an inner view from the
  camera, but keeps it full-canvas — no rect, no clip. Viewports are bounded;
  parallax planes are not.
- `<MinimapCanvas>` and `<SceneViewCanvas>` are the higher-level, supported
  answers for the two most common cases. Reach for this module when you need a
  viewport *inside* an existing canvas rather than a second canvas element.
