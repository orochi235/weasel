# Audit round 59 — ui.components.SwatchStrip

## The SwatchStrip story feeds the field a placeholder black after "None" without marking it `unset`, so black can't be picked and an opacity edit writes the placeholder back as a color
- where: packages/ui/src/components/SwatchStrip/SwatchStrip.stories.tsx:38 (StripWithField)
- scenario: apply the "None" swatch (Standard/Basic palette, `value: null`) → `fill` is `null` → `<ColorField value={fill ?? '#000000'} …>` with no `unset`. ColorField then hands ColorChip `placeholder={false}` and treats `#000000` as the held color. (a) Picking black in the native picker: ColorChip's commit sees `draft.rgb === draft.from` and never calls `onChange`, so black cannot be applied after None. (b) The opacity slider stays enabled (`alphaLocked` is false), so dragging it commits `#000000xx`: the placeholder black becomes a real fill. That is exactly what `ColorField`'s `unset` prop exists to prevent ("so an opacity edit cannot write the placeholder back as a color"). The story is the reference for pairing the strip with a field and should pass `value={fill ?? undefined} unset={fill === null}`.
- evidence: read (ColorField.tsx:22-24, 64, 82, 100; ColorChip.tsx:44)
- severity: medium

## Whether the strip wraps its grids in a RecentColorsProvider depends on whether `store` equals the context's store, so a change in that equality remounts every swatch
- where: packages/ui/src/components/SwatchStrip/SwatchStrip.tsx:181 (SwatchStrip)
- scenario: an app passes `store={s}` to a strip under a `RecentColorsProvider` whose store is first another one and later `s`, or the reverse (for example a provider that adopts the document's store once it loads). The condition `props.store && props.store !== ctxStore` flips, and the element above `grids` changes from `RecentColorsProvider` to a fragment. React remounts both SwatchGrids (or SwatchRings) and the palette Select: a focused swatch loses focus, the roving tab stop resets, and an open palette menu closes. The fix is to always render the provider when `store` is given, which does no harm when it is the same store. `holdScope` right beside it is written this way on purpose ("Both scopes always, so turning one on or off does not remount what is inside").
- evidence: read (Disabled.tsx:84-91 for the pattern this misses)
- severity: low

## Files read
packages/ui/src/components/SwatchStrip/SwatchStrip.module.css
packages/ui/src/components/SwatchStrip/SwatchStrip.stories.tsx
packages/ui/src/components/SwatchStrip/SwatchStrip.tsx
packages/ui/src/components/SwatchStrip/index.ts
packages/ui/src/components/SwatchStrip/lab/SwatchArc.stories.module.css
packages/ui/src/components/SwatchStrip/lab/SwatchArc.stories.tsx
packages/ui/src/components/SwatchStrip/lab/SwatchArcView.tsx
packages/ui/src/components/SwatchStrip/lab/swatchArcConfig.ts
packages/ui/src/components/SwatchStrip/lab/useRingReading.ts
packages/ui/src/components/SwatchStrip/palettes.ts

<!-- done: 2 findings, files read: 10 -->
