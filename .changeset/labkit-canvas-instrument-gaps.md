---
'@weasel-js/labkit': patch
---

A drawing instrument can show a readout, and its layers can follow the camera

Three gaps that together made a canvas instrument hard to build.

**`render` is an overlay, not an alternative.** `Workspace` rendered the canvas
*or* the instrument's DOM, so anything that drew lost the ability to put numbers
beside its drawing — for a measuring instrument, most of the point. The
workaround was painting the readout onto a layer as text, giving up selection,
theming, wrapping and layout. `instrument.render(ctx)` is now passed to
`CanvasStack` as children and lands in `.lk-canvas-stack__overlay`. An
instrument returning `null` behaves exactly as before.

**Layers now draw in world coordinates.** The instrument-level adapter passed
`zoom` but dropped `pan`, so panning was inert for every instrument-declared
layer: the gesture moved the view, the layer redrew, and nothing moved. A layer
could not implement panning itself either, because the value never arrived.
`Workspace` now applies the camera to the context before calling `draw`, so a
layer places world geometry directly. `zoom` is still in the args for what must
not scale — `ctx.lineWidth = 1 / zoom`. **A layer that already mapped
coordinates by hand will now double-apply and must drop its own mapping.** The
lower-level `CanvasLayerDescriptor.render(ctx, view)` is unchanged and still
gets an untransformed context, which is what screen-space chrome wants.

**Typed instruments no longer need a cast.** `defineInstrument<TS, TC>` returns
`Instrument<TS, TC>`, which parameter contravariance kept out of
`LabProps.instruments`, so every consumer wrote `as unknown as Instrument` at
the point the types were supposed to pay off. The prop is now `InstrumentList`
(`readonly Instrument<any, any>[]`), newly exported; the `any` is contained to
that alias.
