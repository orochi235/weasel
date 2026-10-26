# viewports

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

Its `ViewTarget.world` is the point in the resolved view's world. The resolver
reads the canvas through `toLocal`, a client point in the canvas's own pixels,
so a canvas under a CSS transform routes and converts by its own rule.

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

## Aims, held side and markers

A view's **aim** is what it shows, read in its own world: a `ViewAim` names its
view (`null` for the root), carries an `extent` in its owner's terms, and can
outline itself in another view's frame or pan itself there. Core's aim is
`RectAim`, a world rect, built by `rectAim`. The frame an aim is drawn into is
an `AimSpace`; `aimSpace2d` builds one from a camera and frame size. A 2D world
is the plane z = 0, which is how a 3D aim (kernel3d's `aimOf3d`) and a 2D view
meet.

**A `<CanvasView>` holds either its camera or its aim.** Pass `view` /
`defaultView` / `onViewChange` and it holds its camera, as before. Pass `aim`, a
world rect or a thunk of the outer camera and frame, and it holds its aim: its
camera is `viewForAim(aim, frame, 'contain')`, the rect fitted uniformly and
centered. A pan or zoom inside an aim-held view reports through `onAimChange`
the held rect moved by that camera change, keeping its shape, not the frame's
rect. The two forms are exclusive in the types: `aim` cannot be passed with
`view`, `defaultView`, `onViewChange` or `viewBounds`.

**`SceneCanvasApi.aimOf(id)` and `setAim(id, aim)`** read and write any view's
aim, the root's at `null`. A camera-held view takes the camera that shows the aim
exactly at its current frame (`viewForAim(…, 'exact')`); an aim-held one
reports the aim through `onAimChange`. The root writes through
the canvas's own input path, so the write clamps to `viewBounds`, reaches
`onViewChange` and ends an `animateView` glide.

**A marker** is one view's aim outlined in another's frame, after that frame's
layers: `<ViewMarker id source target style interactive>`, or the same props in
a contribution's `markers`. `source` is a view id, `null` for the root, or an
`AimSource` (an aim handed in by value, with an optional writer). The default
style is `VIEW_MARKER_DEFAULT_STYLE`: white, 1px, dashed [2, 3]. Marker ids are
unique per surface. Two contributions declaring the same id throw; a second
`<ViewMarker>` with a live id logs an error and is skipped, so the first keeps
painting and taking presses.

Dragging a marker pans its source: a press inside its outline, or within
`VIEW_MARKER_HIT_SLOP_PX` of it, starts the `view.marker.drag` action
(`VIEW_MARKER_DRAG`). That binding comes from an always-on entry the surface
installs, so `actions={null}` and a `tools` takeover both turn dragging off;
the marker still paints, and presses fall through to the view's own bindings.
Passing `createViewMarkerContribution()` in `ambient`, or in a takeover's own
`useTools` ambient list, turns it back on.
`interactive={false}` turns off one marker, and a by-value source with no
`setAim` is never draggable.

## Related

- [`../parallax`](../parallax/README.md) also derives an inner view from the
  camera, but keeps it full-canvas — no rect, no clip. Viewports are bounded;
  parallax planes are not.
- `<MinimapCanvas>` and `<SceneViewCanvas>` are the higher-level, supported
  answers for the two most common cases on a second canvas element. For a
  minimap *inside* the canvas, `createMinimapContribution` installs one as a
  view with its input and chrome in one `ambient` entry
  ([`../minimap`](../minimap/README.md)). Reach for this module when you need a
  viewport of your own inside an existing canvas.
