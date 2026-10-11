---
'@weasel-js/paint': patch
'@weasel-js/core': patch
---

paint: the CSS color parser and the gradient helpers live here now. `parseColor`, `parseColorToRgba255`, `resolveColor`, `normalizeHex`, `hexToRgba`, `rgbaToHex`, `isGradientFill`, `sampleGradientStops`, `withGradientKind`, `gradientGeometry`, and `gradientForBounds` moved from `@weasel-js/core`, which still exports every one of them. New from paint: `resolveGradientStops` and `sampleResolvedStops`, with the `ResolvedGradientStop` type.
