# `@weasel-js/font` — extracting the glyph tier

Splits the MSDF font machinery out of `@weasel-js/core` into a fifth Tier A
leaf, and replaces the "unregistered family renders nothing" trap with a
configurable fallback policy.

Sequenced first: it is a mechanical move plus one behavior change, greenable
on its own. `docs/superpowers/specs/2026-07-28-text-properties-design.md`
builds on it — the font-family picker reads the registry this package owns.

## 1. Dependency direction

Core depends on leaves. `packages/core/package.json` already lists
`@weasel-js/geom`, `@weasel-js/gestures`, `@weasel-js/history`, and
`@weasel-js/modes` as real dependencies — Tier A in
`docs/superpowers/specs/2026-07-26-subpackage-publishing-design.md`. The rule
that governs those packages is not "core must not import subpackages"; it is
**a subpackage must not import core**, because that is a cycle.

`font` becomes the fifth such leaf. Core adds it to `dependencies`; the
package imports nothing from core.

The alternative shape — text moved *above* core like `@weasel-js/svg`, with
the renderer acquiring a registered text-draw backend — was considered and
rejected. It is the only arrangement that makes text droppable weight, and
droppable weight is not a goal here. It would cost a seam inversion in
`WeaselRenderer` for a benefit nobody asked for.

## 2. What moves

Roughly 800 lines, all of which already import nothing from core except two
type-only references handled in §3:

| From | To |
| --- | --- |
| `features/text/atlas/FontAtlas.ts` | `packages/font/src/FontAtlas.ts` |
| `features/text/atlas/GlyphLayout.ts` | `packages/font/src/GlyphLayout.ts` |
| `features/text/atlas/registerFont.ts` | `packages/font/src/registerFont.ts` |
| `features/text/dynamic/*` | `packages/font/src/dynamic/*` |
| `renderer/shaders/textSdf.ts` | `packages/font/src/textSdf.ts` |

`textSdf.ts` is shader **source strings**, not GL state — it has no
`WebGL2RenderingContext` reference. It belongs with the atlas whose sampling
and channel layout it encodes; keeping them in separate packages means an
atlas format change and its shader change land in two places.

Tests move with their subjects and must pass unchanged. That is the
extraction's correctness proof: no test edits beyond import paths.

## 3. What stays, and why

**`features/text/atlas/layoutRuns.ts` stays in core.** It imports `FillStyle`
(from `core/paint-types`) and `ResolvedRun` (from the run model), so moving it
would drag `paint-types` — and transitively `renderer/textures/registerTexture`
for `TextureHandle` — down into a new `paint` leaf. That extraction may be
worth doing someday; it is not worth doing as collateral damage of a font
split. `layoutRuns` imports `resolveFontVariant` from the new package, which
is the normal direction.

Everything else under `features/text/` stays: the run model, measurement,
`textLayer`, `textCommand`, editing, and the DOM bridge. The package boundary
is **glyphs**, not typography.

## 4. The one seam: `GlyphTextureSink`

`registerFont.ts` and `dynamic/dynamicAtlas.ts` currently take core's
`GLTextureCache` as a **type-only** import and call exactly four methods. The
leaf declares the structural interface instead:

```ts
export interface GlyphTextureSink {
  has(id: string): boolean;
  upload(id: string, source: TexSource): string;
  uploadR8(id: string, w: number, h: number, data: Uint8Array): void;
  subImageR8(id: string, x: number, y: number, w: number, h: number, data: Uint8Array): void;
}
```

Core's `GLTextureCache` satisfies it structurally. No adapter, no
registration, no runtime cost, no injection ceremony — the type is the whole
seam. `TexSource` moves with it.

`_markAllFontsNotUploaded()` — which `WeaselRenderer` calls on context loss —
becomes a plain exported `markAllFontsNotUploaded()`. The underscore marked it
as core-internal; it is now a documented cross-package call.

## 5. Fallback policy — the behavior change

Today `resolveFontVariant` walks a rich chain **within** a family: exact
match, then nearest weight in the same bucket, then `(family, 400, style)`,
then the opposite style with synthetic bold/skew flags for the shader to
compensate. Families explicitly passed to `registerCanvasFont` get a dynamic
canvas-SDF tier.

What is missing is **cross-family** fallback. An unregistered family reaches
`missResolveResult`, returns `entry: null`, and renders no glyphs at all. That
is the single most common "my text is invisible" cause, and the text README
documents it as a known trap rather than fixing it.

The package ships a policy beside the registry:

```ts
setFontFallbackPolicy(p: 'substitute' | 'canvas' | 'none'): void  // default 'substitute'
setDefaultFontFamily(family: string): void   // defaults to the first registered family
```

- **`'substitute'`** (default) — resolve to the default family and keep
  rendering. Warn once per `(family, weight, style)`, following the
  `warnedUniforms` once-pattern in `renderer/draw.ts`.
- **`'canvas'`** — auto-register the unknown family with the dynamic
  rasterizer, yielding the real typeface at canvas-SDF quality when the
  browser has it. Opt-in, because it silently rasterizes whatever the system
  resolves.
- **`'none'`** — today's behavior, retained deliberately. Tests and CI want a
  missing font to be loud, and a consumer may prefer nothing to wrong metrics.

Substitution is reported structurally, not only to the console. `ResolveResult`
gains:

```ts
substituted?: { requested: string; resolved: string };
```

so a UI can say "Inter — not loaded, showing Roboto" rather than leaving the
user to wonder why the family control did nothing. The text-properties spec
consumes this field directly.

**Known caveat:** substituting changes advance widths, so measurement and wrap
differ from the intended font. The structural report is the mitigation; there
is no way to have both a visible fallback and the correct metrics.

## 6. Reflection

`listFonts(): readonly RegisteredFont[]` — family plus available variants —
exported so a picker can enumerate what is actually registered. This is the
"registries should be reflectable" item from `docs/TODO.md`'s system-registries
section, applied to the one registry that now owns a package. It does not
attempt the general `createReflectable<T>()` utility.

## 7. Consumer churn

- **`packages/hud/src/fonts/registerDefaultFont.ts`** imports `registerFont`
  from `@weasel-js/core/renderer`; it repoints at `@weasel-js/font`, and hud
  gains the dependency. Note hud's Vite-specific `?url` asset imports are
  unaffected — hud stays Tier C, the font package is Tier A and ships no
  assets.
- **`scripts/gen-font.ts`** (`npm run gen:font`) moves into the package it
  generates for. The root script alias stays so the command doesn't change.
- **Core keeps re-exporting `registerFont`** from `./renderer`. It is the
  documented "register before you render" entry point; breaking it buys
  nothing and the text README would have to be rewritten around a second
  install step.
- **`packages/core/tsup.config.ts`** and the root `vite-aliases.ts` /
  `tsconfig.json` path maps gain the new package, following the four existing
  leaves.

## 8. Scope boundary

Not in this spec: any change to `layoutRuns`, the run model, `TextStyle`, the
GL draw path's geometry, or HarfBuzz shaping. No API changes beyond §4's
rename, §5's policy, and §6's `listFonts`. The dynamic atlas keeps its
no-eviction v1 behavior.

## 9. Testing

1. **Moved tests pass unchanged** (import paths aside) — the extraction proof.
2. **Leaf purity** — a test asserting `packages/font/src` contains no
   `@weasel-js/core` import. No such guard exists for the current leaves
   either; the tiered build catches it indirectly, because a leaf's tsconfig
   has no path to core. An explicit test makes the failure legible instead of
   a confusing module-resolution error.
3. **Fallback policy per mode** — `'substitute'` renders with the default
   family and populates `substituted`; `'canvas'` auto-registers and resolves
   through the dynamic tier; `'none'` reproduces today's `entry: null`.
   Warn-once asserted by spying on the console across repeated resolves.
4. **Publish manifests** — `scripts/check-publish-manifests.mjs` and
   `scripts/smoke-consumer-bundle.mjs` cover the new package, and it joins the
   lockstep `fixed` changeset group at `0.6.0`.
5. **Singleton audit** — `scripts/smoke-consumer-bundle.mjs` statically
   asserts that importing `registerFont` from both `weasel-js/renderer` and
   `@weasel-js/core/renderer` does not bundle two copies, using the font
   registry as the canary ("two copies means two React hook instances and two
   font registries"). After the move, `registerFont` resolves through core's
   re-export into `@weasel-js/font`, so the canary must be extended to assert
   that `@weasel-js/font` itself is single-instance — otherwise the check
   silently starts proving something weaker than it did.
