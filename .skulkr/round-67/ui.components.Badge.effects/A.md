# Audit round 67 findings: ui.components.Badge.effects

## Drawn effects let NaN through their clamps, where the offset effects read it as the default
- where: packages/ui/src/components/Badge/effects/Sunbeams.tsx:59 (Sunbeams.Component); also Metal.tsx:63, Shadow.tsx:25, Sheen.tsx:30, Woodgrain.tsx:54, Bevel.tsx:42 / Bevel2.tsx:46 (bevelWidth)
- scenario: `{ type: 'sunbeams', params: { irregularity: NaN } }`: `Math.max(0, Math.min(NaN, 1))` is NaN, so every beam's width, angle and opacity come out NaN and the polygons' `points` read `NaN,NaN …`, so nothing draws. The same thing happens with `metal` `specularity: NaN` (every color-mix and alpha becomes NaN), `shadow`/`sheen`/`woodgrain` opacity or intensity NaN (`rgba(0, 0, 0, NaN)`, `stopOpacity="NaN"`), and `bevel`/`bevel2` `bevelWidth: NaN` (band paths full of NaN). Round 65 ruled that NaN or an infinite value in a `spikes`/`puffs`/`bites`/`scallops` param reads as that param's default (`finiteOr`/`clampParam`). The drawn effects never got that treatment, so one input gets two different answers depending on which effect receives it.
- evidence: read
- severity: low

## bevel2 gives a non-finite `lightFrom` unstyled bands, where bevel/sheen/rivets throw a RangeError
- where: packages/ui/src/components/Badge/effects/Bevel2.tsx:39-45 (bucketFor)
- scenario: `lightFrom: NaN` (or Infinity) makes `lx`/`ly` NaN, so `t` is NaN and `Math.floor(NaN * 6)` is NaN. `SHADE_CLASSES[NaN]` is undefined. Because `NaN !== NaN`, `bevelBands` also opens a new run for every one of the 240 samples, which gives 240 paths with no class. The result is unstyled black fill (SVG's default) over the whole bevel ring. Round 65 had the corner-light effects throw a RangeError naming the effect for a bad `lightFrom`. Bevel2's numeric `lightFrom` is never checked.
- evidence: read
- severity: low

## Woodgrain's grain lines stop at a fixed -5..105 span and miss outline that warping effects push past the box
- where: packages/ui/src/components/Badge/effects/Woodgrain.tsx:35-39 (Woodgrain.Component)
- scenario: a composed badge with `spikes` (length 8 CSS px, vertScale 1.4) or `puffs` on a 40 px-wide box puts its outline about 20 viewBox units outside 0..100. Every grain curve runs from x=-5 to x=105, and the curves only sit at y in (0, 100). So the spike tips and puffs come out flat with no grain, while the rest of the body is grained. Sunbeams and Aqua/Metal's gloss size themselves to `outlineRegion(sampler, 0)` for this case ("run past the outline's farther edge"). Woodgrain ignores it, so the same question gets two answers.
- evidence: read
- severity: low

## Perforations rounds its hole count up, so holes asked to sit `2 × holeRadius` apart can overlap
- where: packages/ui/src/components/Badge/effects/Perforations.tsx:27-29 (Perforations.Component)
- scenario: `pitch = max(2r, holeSpacing)` is meant to keep holes from touching. But `N = Math.round(total / pitch)` can round up, which makes `step = total / N` smaller than `pitch`. For example, holeRadius 3, holeSpacing 6, total 15 CSS px: pitch 6, N = round(2.5) = 3, step 5 < 6, so neighboring holes overlap by 1 px and merge into a slot. Bites and Scallops use `Math.floor` for the same spacing guarantee, and their bumps never collide.
- evidence: read
- severity: low

## shadow and sunbeams draw on any variant, where every other drawn effect skips variants with no fill
- where: packages/ui/src/components/Badge/effects/Shadow.tsx:16 (Shadow.Component); Sunbeams.tsx:51
- scenario: with `variant="outline"` (BadgeDeco draws no `badge-fill`, only a stroke), `shadow` still paints the whole body silhouette at 28% black behind the transparent body. The outline badge reads as a gray-filled blob. `sunbeams` likewise paints its beams over the unfilled body. Bevel, Bevel2, Sheen, Rivets and Woodgrain all return null unless the variant is `solid`/`subtle`. Aqua and Metal explicitly opt in to `outline` because they paint their own body. Shadow and Sunbeams make neither choice, so the variant gating comes out two ways.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/Badge/effects/Aqua.tsx
packages/ui/src/components/Badge/effects/Bevel.tsx
packages/ui/src/components/Badge/effects/Bevel2.tsx
packages/ui/src/components/Badge/effects/Bites.tsx
packages/ui/src/components/Badge/effects/Metal.tsx
packages/ui/src/components/Badge/effects/Outline.tsx
packages/ui/src/components/Badge/effects/Perforations.tsx
packages/ui/src/components/Badge/effects/Puffs.tsx
packages/ui/src/components/Badge/effects/Rivets.tsx
packages/ui/src/components/Badge/effects/Scallops.tsx
packages/ui/src/components/Badge/effects/Shadow.tsx
packages/ui/src/components/Badge/effects/Sheen.tsx
packages/ui/src/components/Badge/effects/Spikes.tsx
packages/ui/src/components/Badge/effects/Sunbeams.tsx
packages/ui/src/components/Badge/effects/Woodgrain.tsx
packages/ui/src/components/Badge/effects/bevelBands.ts
packages/ui/src/components/Badge/effects/bumps.ts
packages/ui/src/components/Badge/effects/glassStrokes.tsx
packages/ui/src/components/Badge/effects/index.ts
packages/ui/src/components/Badge/effects/lightCorner.ts
packages/ui/src/components/Badge/effects/rangeMask.ts

<!-- done: 5 findings, files read: 21 -->
