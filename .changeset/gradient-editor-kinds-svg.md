---
"@weasel-js/core": patch
"@weasel-js/ui": patch
"@weasel-js/svg": patch
"@weasel-js/labkit": patch
---

`GradientEditor` offers every registered gradient kind, mesh included, instead of a fixed linear / radial / conic list. A kind counts as a gradient when its registry entry carries the two new optional `PaintKindEntry` slots, `stopsOf` (the stop list a paint reads as) and `fromStops` (a paint built from one); `listGradientKinds()` returns those kinds, and `switchGradientKind(paint, kind)` converts between any two of them. Between linear, radial and conic it is `withGradientKind` and keeps the geometry; to a mesh, a stop list becomes one full-height patch per gap between stops, so a horizontal ramp survives unchanged, and a mesh reads back as the ramp across its patches' top edges. `meshFromStops` and `meshStops` are exported. A mesh value shows `MeshEditor`'s corner colors; a registered kind's own `Editor` wins, as it does in `PaintInput`. `PaintInput` now converts through `switchGradientKind` too, so switching a gradient to a mesh carries its colors instead of seeding a new mesh from one color.

`GradientEditor`'s `value`, `onInput` and `onChange` are now typed `FillStyle` rather than `GradientFill`, since a mesh is not a `GradientFill`; a handler typed to take `GradientFill` needs widening.

`GradientEditor` also takes `svg`, off by default, which limits the choices to what an SVG file carries natively: the linear and radial gradients, blended in sRGB. A value already outside that set keeps its own kind and space on offer. `@weasel-js/svg` exports the rule as `nativeSvgKind(kind)` and `nativeSvgSpace(space)`, the same predicates its serializer uses to decide when a paint needs a fallback color or a `wzl:interpolate` attribute.
