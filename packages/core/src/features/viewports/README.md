# viewports

`@experimental`

One file. A **viewport node** is a screen-space rectangle on the outer canvas
that re-renders one or more source layers through an *inner* `View`, then clips
them to its rect.

Use cases: picture-in-picture, minimap, scrolling container, multi-angle
preview.

## Viewports are lenses, not copies

The same source layer can be rendered through several viewports with different
inner views **without duplicating the data**. A viewport doesn't own content;
it owns a view onto content that lives elsewhere. Adding a second viewport onto
the same layers costs another draw pass, not another copy of the scene.

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
