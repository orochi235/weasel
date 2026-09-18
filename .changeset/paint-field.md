---
'@weasel-js/ui': patch
---

`PaintField` edits a whole `FillStyle` from one control slot: a swatch naming
the kind it holds, and a popover holding `PaintInput`. `PaintInput`'s kind bar
and stop editor do not fit a property row's control column, which is why a
`paint` leaf in `PrefsForm` used to render a `ColorField` — reading a gradient's
first stop and writing a solid back, so touching the control lost the paint.
That leaf now renders `PaintField`, and a gradient survives being edited.

`paintPreviewCss` turns any paint into a CSS `background`, for swatches and
chips. Gradients are sampled through their own blend space rather than handed
over as stops, so an OKLCh gradient previews as itself instead of as the sRGB
blend of its ends.
