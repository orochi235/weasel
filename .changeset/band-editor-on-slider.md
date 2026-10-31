---
"@weasel-js/ui": patch
---

`BandEditor`'s bands are now a `Slider`: each seam is a thumb, each band is the region between two seams, and
dragging a band body is a region drag. Its props and gestures are unchanged. Where it now behaves differently:

- A seam's `aria-valuemin` and `aria-valuemax` are the ends of the range, as every `Slider` thumb reports them,
  rather than its neighboring seams.
- Page Up and Page Down move a focused seam ten steps, as they do any slider thumb.
- A seam or band no longer carries `data-seam-index`, `--be-at`, `--be-from` or `--be-to`; a seam is placed by
  `left`, and a band by its region.
- The strip holds its direction to ltr, as the ruler and edges always were; a band's caption takes its direction
  from its own text.

`Slider` gains what that took, all of it general:

- `renderRegion` draws something across each stretch of track between neighboring thumbs, and before the first and
  after the last, in the tab order between the thumbs either side. `regionDrag` makes a drag on an inner region move
  both of its thumbs, keeping the span between them.
- `scale` maps values onto the track non-linearly; `logScale` and `linearScale` now export from `Slider` (and still
  from `BandEditor`, whose `BandScale` is the same type as `SliderScale`).
- `stopSnapPx` sets how close a drag must come to a stop to land on it, and holding alt through a drag now passes a
  magnetic stop by. This changes every slider with stops: alt used to do nothing there.
- `onCancel` reports a drag that ended without a release, so a consumer holding the last `onInput` can drop it.
- Shift-dragging every thumb (`allowShiftAll`) on a scaled track moves them by track distance, as it already did
  under `spacing: 'even'`.
