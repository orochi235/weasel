# Theme engine and editor — design

**Status: designed 2026-09-10, not built.** Nothing below exists in the tree yet.
Delete this file when the work merges.

This covers the theme editor at `apps/theme-editor` `#/theme` and the engine in
`@weasel-js/theme` underneath it. It is written for whoever implements it. The
palette lab (`#/palette`) is built and is an input here, not a subject.

Two phases in one arc: **the engine** (definition format, derivation, emission,
weasel converted onto it), then **the editor** on top of it. Phase 1 stands on
its own; phase 2 needs it.

## Decisions this rests on

- **A theme is authored, with a generator filling in what you have not
  decided.** It is not fully derived. A definition with no seeds and every value
  pinned is legitimate, and is what weasel converts to.
- **The editor saves back into the repo.** weasel's own theme is a definition
  file the editor writes; saving regenerates `tokens.css`.
- **Derivation covers color, numeric scales and a density axis in this arc.**
- **The format is weasel's own layered JSON, not DTCG.** DTCG stays as import
  (`loadDTCG`) and becomes an export target.
- **Layout is the workbench**: layer rail, layer editor, live preview in both
  modes.
- Carried from the palette-lab arc, and not to be undone: `equalize` defaults to
  0; `CHROMA_WEIGHT = 3` stays pinned to CIELAB's ordering and CIELAB ΔE
  thresholds do not port to it; weasel's own neutral ramp stays pinned, and only
  new themes get generated ramps.

**Out of scope, next arc (the generic engine):** a configurable prefix (the
emitter still writes `--wzl-`), Tailwind `@theme` output, and splitting a
universal semantic vocabulary from weasel's component tokens. The schema has a
`components` layer, but deciding which weasel tokens belong in it waits for
that arc.

## Phase 1 — the engine

### The definition

One JSON file per theme. Layers run in derivation order: `seeds → ramps →
scales → semantics → components → pins`.

```jsonc
{
  "name": "harbor",
  "extends": "weasel",
  "axes": {
    "mode":    { "default": "dark", "values": { "dark": { "scheme": "dark" }, "light": { "scheme": "light" } } },
    "density": { "default": "comfortable", "values": { "comfortable": {}, "compact": {} } }
  },
  "seeds": { "brand": "#0b6e8a", "neutralHue": 220, "neutralChroma": 0.012, "unit": 4 },
  "ramps": {
    "gray":   { "kind": "lightness", "steps": ["50","100","200","300","400","500","600","700","800","900"],
                "hue": "{seeds.neutralHue}", "lightness": [0.973, 0.163], "curve": 0.35,
                "chroma": { "peak": "{seeds.neutralChroma}", "darkBias": 0.2 } },
    "accent": { "kind": "lightness", "steps": ["soft","base","strong"], "anchor": { "base": "{seeds.brand}" } },
    "swatch": { "kind": "categorical", "steps": ["fuchsia","green","sky"], "gates": { "minContrast": 3 } }
  },
  "scales": {
    "space": { "steps": ["xs","sm","md","lg"], "base": "{seeds.unit}",
               "step": { "by": "density", "comfortable": 4, "compact": 3 } }
  },
  "semantics": {
    "surface":        { "ramp": "gray", "step": { "by": "mode", "dark": "800", "light": "50" } },
    "surface-sunken": { "from": "surface", "offset": 1, "dir": "darker" },
    "fg-muted":       { "from": "surface", "offset": 5, "dir": "away" },
    "border-strong":  { "ramp": "gray", "contrast": { "min": 3, "against": ["surface", "surface-raised"] } },
    "line-subtle":    { "ref": "fg", "alpha": 0.10 }
  },
  "components": { "tb-height": "28px" },
  "pins": { "gray-800": "#141820" }
}
```

**Token names.** A ramp or scale step becomes `<ramp>-<step>` (`gray-800`,
`accent-base`, `space-md`). Semantics, components and pins are named by their
key. References are `{token}` for a token and `{seeds.name}` for a seed. The
DTCG `{group.token}` form is accepted only by `loadDTCG`.

**Varying by axis.** Any value anywhere can be written
`{ "by": "<axis>", "<value>": …, … }`: a seed, a ramp or scale setting, a
semantic's step, a pin. Every value of the axis must be given. Nothing
declares a token's axis dependencies; the engine derives them (below).

**Ramps.**
- `lightness`: an OKLCH walk from `lightness[0]` to `lightness[1]`. `curve`
  blends an even walk (0) toward a smoothstep S (1), which keeps small steps at
  both ends for elevation and larger ones through the middle for text contrast.
  Chroma follows an envelope peaking mid-ramp, with `darkBias` lifting the dark
  half. Every step is gamut-clamped. `anchor` pins named steps to exact colors
  and takes hue and chroma from them. This is the "pin the brand step, derive
  around it" case.
- `categorical`: the palette lab's `generate()`, with its constraints under
  `gates` and its anchors. `steps` names the output in order (farthest-point
  order, so a prefix stays separated).

**Scales.** `base + step × i` (linear) or `base × ratio^i` (geometric), rounded
to whole px. Either parameter may vary by axis, which is where density comes
from.

**Semantics.** Every semantic ends on a ramp step, never on a hex, which is
what lets one definition produce every mode. The rule kinds:
- `step`: a named step.
- `offset`: N steps from another semantic's step, `lighter`, `darker`, or
  `away` (away from the reference toward the far end of the ramp, so it flips
  with mode). A plain mirror flip is deliberately absent: mirroring a light
  theme's darker sunken surface puts it *above* surface in dark.
- `contrast`: starting beside the `against` surfaces and walking away from
  them, the first step whose WCAG contrast clears `min` against every one. If no
  step does, validation reports it; the rule never silently picks something
  else.
- `ref` (with optional `alpha`) and literals, as today.
- Any semantic may also carry `check: { contrast, against }`, validated
  without changing the value. This is how a pinned semantic still gets audited.

**Pins** override generated output and are the only values the editor counts
as *overridden*. A pin on a token no generator produces is *authored* instead,
like interstellar's gradient backdrop. A pin is a bare value or
`{ value, type?, description?, alpha? }`; `type` is required when nothing else
supplies it.

**Descriptions.** Any entry may carry `description`. Ramps and scales take
`describe: { <step>: text }`. They reach `tokens.css` comments and
`TOKEN_MANIFEST` as today.

### Derivation

`derive(definition, selection)` in `packages/theme/src/engine/`, exported as
the subpath `@weasel-js/theme/engine`:

1. Merge the `extends` chain at the definition level, so a child's semantics can
   walk the parent's ramps.
2. Pick every `by` value for the selection.
3. Run seeds, ramps, scales, semantics, components, pins, in that order.
4. Return `FlatTokens` (the shape `resolveTokens` already takes) and a
   provenance record per token: layer, rule, whether a pin overrode it, and what
   the rule alone would have produced.

**Axis dependencies.** A token depends on an axis if it has a `by` on it, or
if it reaches such a value through a reference, a rule input (an `offset`'s
`from`, a `contrast`'s `against`) or a ramp/scale parameter.

**Validation** runs per selection: unmet `contrast` rules, failing `check`s,
`by` objects missing a value, and untyped pins. Cycles and dangling references
throw, as `resolveTokens` does today.

**Compiling is baking.** Run `derive` for every selection and write the results
back as pins, and you get a definition with no seeds and no rules. That is the
runtime `Theme`. `resolveTheme`, `applyTheme`, `defineTheme` and `loadDTCG` all
work on it, and none imports a generator, so a consumer of the runtime entry
never bundles one. `defineTheme` throws on a definition that needs derivation
and points to `@weasel-js/theme/engine`.

### Color math

The engine needs sRGB ↔ OKLab/OKLCH. Those conversions live in
`packages/core/src/animation/colorSpaces.ts`, which has no imports.
`@weasel-js/theme` has no dependencies and must not take core, so the
conversions move down into `@weasel-js/paint`, and core re-exports them **by
name** (a star re-export of another workspace package emits no binding; see the
repo CLAUDE.md). theme gains a dependency on paint. The rest of the palette
lab's math (`oklch.ts`: contrast, chroma-weighted ΔE, hue gap, gamut clamp) and
`generate.ts` move from `apps/theme-editor/src/palette/` into the engine, with
their tests.

### Emission

`scripts/build-tokens.ts` reads `packages/theme/themes/*.json` instead of the
DTCG directories and calls the engine's emitters:

- **`tokens.css`.** The default theme gets `:root`; every other theme gets only
  `[data-wzl-theme]` blocks, so two themes never fight over `:root`. A token
  with no axis dependencies appears in `:root` only. A token that depends on one
  axis also appears in a block per value of it:
  `[data-wzl-theme='t'][data-wzl-<axis>='<v>'],\n[data-wzl-<axis>='<v>']`. A
  token that depends on two axes gets the compound blocks for their cross
  product. This generalizes the existing fix for `var()` inside a custom
  property resolving where the property is declared. Within a block, tokens
  whose own value varies on that axis come first, in definition order, then the
  tokens that depend on it only through a reference, which is the order today's
  output uses. An axis value's `scheme` emits `color-scheme` in its blocks. A
  semantic that resolves to a step emits `var(--wzl-gray-800)`, never the hex.
- **`themes.ts`**: `THEMES` resolved for every selection, `THEME_SOURCES` as
  the unresolved definitions, and `TokenName`.
- **`manifest.ts`**: unchanged in shape.
- **DTCG export**: new, the inverse of `loadDTCG`.

### Converting weasel

`packages/theme/themes/weasel.json` replaces `packages/theme/tokens/weasel/`,
converted by a script built on the DTCG import:

- `axes.mode` from `theme.json`; there is no density axis until a visual
  decision adds one.
- Every primitive becomes a pin, in source order; every mode token becomes a
  `by: mode` semantic with a `ref`, in mode-file order.
- `ramps.gray` gets the lightness parameters that generate the proposed ramp
  (`#f5f6f7 #e0e1e4 #c6c8cb #a7a9ae #85888e #64676f #464a51 #2f3137 #1c1e22
  #0c0e12`: L 0.973 → 0.163, `curve` 0.41, hue 266°, chroma peaking about
  0.013 mid-ramp, step spread 1.79× against the shipping ramp's 3.61×). A
  symmetric S at 0.41 lands within 0.0075 in L of every proposed step, less than
  one 8-bit hex step. All ten steps are pinned to today's values, so nothing
  that ships moves; the parameters exist so the editor can show the generated
  ramp beside the pinned one.
- `ramps.accent` is anchored at `base: #2e1f7a`, `ramps.swatch` carries the
  palette-lab gates that produced today's set, and every step of both is
  pinned.

**Gate:** the converted file emits today's `tokens.css` and `manifest.ts` byte
for byte, held by the existing determinism test. `themes.ts` changes shape by
design (`THEMES` keyed by selection, `THEME_SOURCES` holding definitions), so
its gate is value equality instead: every resolved value in the new `THEMES`
equals today's for the same mode, and `TokenName` is unchanged.

interstellar (`packages/labkit/src/theme/interstellar.tokens.json`) converts
the same way to a pins-only definition and loads through `defineTheme`.

### Breaking API changes

All in one pass, with the prose in a `patch` changeset:

- `resolveTheme(theme, selection?)` and `applyTheme(el, theme, selection?)`
  take `{ mode?, density?, … }`; a missing axis takes its default. `applyTheme`
  stamps one `data-wzl-<axis>` attribute per axis.
- `<ThemeProvider selection>` replaces `mode`, and the context value carries
  `selection`.
- `defineTheme` takes a definition. `Theme` holds `axes` instead of `modes`.
- Callers to move: hud (`attach.ts`, `useHud.ts`), labkit's interstellar,
  `apps/draw/src/theme.ts` (whose `{color.x}` refs become `{x}`), and the eleven
  `ThemeProvider` call sites.

## Phase 2 — the editor

### Layout

`#/theme`, in a `LabShell` like the palette lab. The header has the theme
picker, the mode and density being viewed, "N of M overridden", undo/redo,
Export and Save (with a dirty dot). Below it, three columns:

- **Layer rail**: Seeds, Ramps, Scales, Semantics, Components, Pins, each with
  its count and pinned count.
- **Layer editor**: the selected layer.
- **Preview**: real `@weasel-js/ui` components (panel, buttons, checkbox,
  slider, switch, toggle bar, a sunken field) in both modes at once, at the
  viewed density. The preview subtree runs `applyTheme` with the draft under a
  draft theme name; the editor's own chrome stays on the saved theme.

### Layer editors

- **Ramps.** Per lightness ramp: a strip of step swatches with L and ΔL rows
  and the spread, the parameters as sliders, and a pin toggle per step. When
  steps are pinned, the generated row shows beneath the pinned one. "Adopt
  generated" unpins a ramp, and for weasel it asks first, because it
  re-baselines the visual tests. While a ramp is selected, the preview shows
  pinned and generated side by side. A categorical ramp shows its set, and
  "edit gates" opens the palette lab's constraint panel (`PropertyPanel`
  groups, `AnchorList`, the unmet-gate report) in place. The palette lab
  components move to shared files for this; the `#/palette` route stays.
- **Scales.** A ladder per scale, one column per density value.
- **Semantics.** A table with swatch, token, rule in short form, resolved step
  per mode, worst contrast with pass/fail, and pinned/revert. Selecting a row
  opens a drawer: rule kind (step / offset / contrast / ref / literal), its
  fields, and a per-mode table of what the rule produced, what a pin
  overrides it with, and contrast against each checked surface.
- **Seeds, Components, Pins.** Plain property rows. Pins lists every override
  with what it replaced.

**Click to inspect.** Clicking a component in the preview collects the
stylesheet rules that match it and the `var(--wzl-*)` names they read, and
jumps the layer editor to those tokens. It reads the real CSS modules, with no
per-component table.

### Saving

- **A dev-only vite plugin** in `apps/theme-editor/vite.config.ts` serves
  `GET /__theme/list`, `GET /__theme/<name>` and `PUT /__theme/<name>` for the
  known definition files (`packages/theme/themes/*.json` and interstellar's). It
  refuses any other path. `PUT` writes the JSON in stable key order, then runs
  the same emit function `build-tokens` uses, and returns the validation report.
- **Conflict check.** `PUT` carries the hash of the file as loaded. If disk has
  moved on (another session in this working directory, a checkout), the plugin
  answers 409 and the editor offers to reload.
- **Saves are explicit.** Undo/redo covers every edit, through the palette
  lab's `useLabHistory`. The unsaved draft survives a reload, with parsing split
  from storage as in `presets.ts`.
- **New theme** starts from default seeds, extending weasel, and stays a draft
  until saved to a known location. **Export** writes the emitted CSS, the
  definition, or DTCG for any theme.

## Testing

- **Conversion:** the gates above; DTCG import → export round-trips.
- **Engine** (`weasel-ui` vitest project, which owns `packages/theme`): the
  lightness generator, from the converted parameters, lands within 0.01 in L and
  0.003 in C of every proposed gray step, with L monotone and every step in
  gamut; the
  `contrast` rule over surface/raised/sunken resolves `border-strong` to 400 in
  dark and 500 in light, and reports when no step exists; `offset` in both
  modes; a token that reaches density only through a reference chain counts as
  density-dependent; emission with compound blocks. The moved palette tests
  keep `cost.test.ts`'s budget and chroma floor.
- **Browser, not jsdom:** a `tests/visual` probe for a token that depends on
  two axes through a reference (jsdom resolves neither `var()` nor
  `color-mix()`), and screenshots of the editor in both modes after a hard
  reload.
- **Editor** (`draw` project): overridden counts, pin and revert, provenance
  in the drawer, and the 409 path. The plugin is tested as a function against
  a temp directory, asserting the file on disk rather than the response.
- Root `npx tsc --noEmit` covers the breaking callers;
  `npm run check:test-projects` covers the moved tests.

## Open

**Light `border-strong`: gray-400 or gray-500?** The border merge put it on 400
in both modes, which leaves light over `surface-sunken` at 2.93:1. A `contrast`
rule over all three surfaces picks 500 in light (7.40 / 6.52 / 4.96) and passes
everywhere, at the cost of darker control edges in light mode. It is weasel's
value either way and does not block this work.
