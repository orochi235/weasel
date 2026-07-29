# @weasel-js/hud

## 0.7.0

### Minor Changes

- d3e5597: Extract the MSDF glyph tier into a new `@weasel-js/font` package: font
  registry, atlas parsing, glyph layout, runtime rasterization, and the SDF
  text shader source. `@weasel-js/core` depends on it; `registerFont` is still
  re-exported from `@weasel-js/core/renderer`, so existing call sites keep
  working.

  Unregistered font families now render in the default family with a one-time
  warning instead of rendering nothing. Configure with
  `setFontFallbackPolicy('substitute' | 'canvas' | 'none')` — `'none'`
  restores the previous hard-miss behavior, and `'canvas'` rasterizes the real
  typeface at runtime when the browser has it. A family the `'canvas'` policy
  enrolled for itself stops being canvas-served once the policy changes; one
  you name with `registerCanvasFont` is served under every policy, and
  `isCanvasFont` reports that distinction — it answers "will the dynamic tier
  serve this family right now", so an auto-enrolled family reads `false` under
  `'substitute'` and `'none'`. The default
  family may be a canvas-registered family, and when it cannot serve the
  request either, the resulting blank text is reported with its own warning
  naming the default family rather than failing silently. Requesting the
  default family itself also warns — whether it is registered at a variant it
  can't serve, or `setDefaultFontFamily` named a family that was never
  registered at all; either way there is nothing left to fall back to. An app
  that has registered no fonts and set no default stays silent, since that is
  not a misconfiguration.

  `ResolveResult.substituted` reports the substitution structurally, and
  `ResolveResult.resolved` now
  carries the matched `family` alongside `weight` and `style` — the full atlas
  identity to pass to `getFont` / `textureCacheKey`.

  Adds `listFonts()` for enumerating registered families.

### Patch Changes

- Updated dependencies [d3e5597]
- Updated dependencies [a925117]
- Updated dependencies [eeae450]
  - @weasel-js/font@0.7.0
  - @weasel-js/theme@0.7.0

## 0.6.0

### Patch Changes

- @weasel-js/theme@0.6.0

## 0.5.1

### Patch Changes

- 5a741be: Ship the TypeScript declarations that `ui` and `hud` already advertised.

  `@weasel-js/ui@0.5.0` and `@weasel-js/hud@0.5.0` were published with no `.d.ts`
  files at all, while their `exports` maps pointed `types` at `./dist/index.d.ts`.
  Consumers got an implicitly-`any` module.

  Both packages build as `vite build && tsc -p tsconfig.build.json`. Vite's
  `emptyOutDir` deletes the declarations the previous run emitted, but tsc's
  `--incremental` state (inherited from the repo root) still recorded them as
  emitted, and plain `--incremental` compares input signatures without checking
  whether the outputs are still on disk. So every build after the first emitted
  nothing and exited 0. A cold CI checkout only ever builds once, which is why
  this never went red. Their declaration builds are no longer incremental.

  Two gates now cover the class rather than the instance: `npm run check:manifests`
  refuses to publish a package whose `exports`/`types` map names a file that
  `npm pack` would not include, and the consumer smoke test type-imports both
  packages so a missing declaration surfaces as TS7016.

  - @weasel-js/theme@0.5.1

## 0.5.0

### Patch Changes

- @weasel-js/theme@0.5.0
