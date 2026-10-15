# Kit settings

**Status: unbuilt.** Design approved 2026-10-15; implementation tracked by the P1 "The kit has no
settings of its own" in `docs/TODO.md`. Delete this file when the last arc merges.

For whoever builds or reviews this. It answers: where does behavior a user would set once for the
whole kit — timings, thresholds, target sizes, rates — live, how does every component read it, and
how can a prefs schema be turned into CSS custom properties.

## Shape

| Piece | Lives in | Holds |
|---|---|---|
| Defaults | beside their code, as today's constants (`DOUBLE_CLICK_MAX_MS`, `TYPEAHEAD_MS`, …) | the only definition of each default |
| `KitSettings` interface | `@weasel-js/react` barrel | the typed tree, one key per area; packages add areas by `declare module '@weasel-js/react'` |
| Settings store + `<KitSettingsProvider>` + `useKitSetting(path)` | `@weasel-js/react` | overrides only, no defaults; no prefs dependency |
| Pref schema groups (labels, units, ranges) | `ui` for its components; `core` for gestures and canvas areas | `default`s import the constants above |
| Store → provider bridge | `@weasel-js/prefs/react` | feeds `store.values()` in; optionally adopts `prefsCss` |
| Schema → CSS | `prefsDefaultsSource` in `@weasel-js/prefs`; `@weasel-js/prefs/vite` | the defaults sheet, opt-in |

`gestures` has no dependencies and stays that way: it exports constants and takes thunks. `core`
writes its schema group around them.

## Reading a setting

- **Precedence:** a component's own prop, then the nearest provider, then the constant.
- **React readers:** `useKitSetting('tree.typeaheadMs') ?? TYPEAHEAD_MS`. The hook reads the store
  through `useSyncExternalStore` with a per-path selector, so changing one setting re-renders only
  its readers — a prefs page dragging a slider must not re-render every tree on screen.
- **Nesting:** a nested provider deep-merges over its parent, so a subtree overrides one value.
- **Non-React readers** (the gesture recognizer, canvas actions, layers) take a thunk —
  `kitSettings.get(path)` from the same store — read at the moment of use, so a change reaches the
  next press. The recognizer already does this for `longPressMs`
  (`routing/src/interactions/dispatcher/channels/pointer.ts`); the rest follow that shape.
- **Augmentation trap:** `KitSettings` must be declared in `@weasel-js/react`'s barrel itself. An
  augmentation merges through one re-export hop, not two (see CLAUDE.md, Traps).

## What goes in

Anything a user, or an app on a user's behalf, would set once for everything. Correctness limits
stay constants: a settings surface says changing them is supported.

| Area | Settings | From |
|---|---|---|
| `gestures` | `doubleClickMs`, `doubleClickPx`, `longPressMs`, `tapPx`, `dragPx` | `gestures/recognizer/thresholds.ts`, `ui/dragThreshold.ts` |
| `numberField` | `repeatDelayMs`, `repeatEveryMs` | `UnitField.tsx` |
| `params` | `form` / `panel` / `lab`, each with `textWaitMs` and `settles.<control>` | `Prefs/commitPolicy.ts` |
| `tree` | `typeaheadMs`, `hoverExpandMs`, `tipRestMs` | `Tree.tsx`, `useTreeDrag.ts`, `useRowTip.ts` |
| `help` | `focusDelayMs` | `Properties/rowHelp.ts` |
| `toast` | `ttlMs` | `Toast/queue.ts` |
| `targets` | hit and snap radii, overlay dot sizes | `core/device/targets.ts` (joins its device scaling), the `*_HIT_PX` / `*_SNAP_PX` / `*_RADIUS_PX` constants in core and ui, guide and pick tolerance |
| `view` | `animationMs`, defaulting to 0 under `prefers-reduced-motion` | `useViewAnimation.ts` |
| `history` | `coalesceMs` | the `COALESCE_MS` constants |
| `orbit3d` | `orbitRate`, `dollyRate` | `kernel3d/tools.ts` |
| `loupe` | `wheelRate` | `labkit/loupe/loupeActions.ts` |

Staying constants: renderer and animator internals (`REBASE_TRANSLATION_PX`, `SLACK_PX`,
`RESYNC_MS`, `RETIME_MS`), `ENABLED_BUDGET_MS`, forge and labkit timeouts, `Select`'s `CLICK_MS`.

`params` is nested per surface, not split by a surface enum: a split leaf is chosen by one global
selection, and a surface is a property of the component, varying within one page.

## Schema → CSS custom properties

- **`prefsDefaultsSource(schema)`** answers `PrefsCssSource` (`values`, `locus`, `get`) from each
  leaf's `default` and `defaultLocus`. `prefsCss` is unchanged; one emitter serves a store and a bare
  schema. Its test: output equals `prefsCss` over a store opened at defaults.
- **`@weasel-js/prefs/vite`** exports `weaselPrefsCss({ schemas, css? })`. `schemas` maps a module id
  to an export name; `css` is `PrefsCssOptions`. It serves `virtual:weasel-prefs.css`, loading schemas
  with vite's `runnerImport` and invalidating the module when one changes. Leaving the plugin out is
  the off switch.
- **Runtime:** the bridge takes `css`. Set, it adopts `prefsCss(store)` into the document or shadow
  root's sheet and sets `prefsCssAttributes` on the root, again on each store change, so persisted
  user values reach CSS. The adopt step is written in prefs; folding `theme`'s `holdRule` and core's
  canvas rule into it is not a prerequisite.
- **Naming:** kit settings write as `--wzl-kit-<area>-<setting>` through the `property` option, clear
  of theme tokens.

## Arcs

Each arc is its own worktree and merges to `main` on a green `npm run test:fleet`.

1. Store, provider, `useKitSetting`, `KitSettings` in `@weasel-js/react`.
2. `ui` areas and their schema group.
3. `gestures` thunks, dispatcher wiring, core's gesture schema group.
4. `targets`, `view`, `history`, `orbit3d`, `loupe`: core plumbing and schema.
5. `prefsDefaultsSource`, `@weasel-js/prefs/vite`, runtime adopt in the bridge.
6. A lab showing the composed schema in `Prefs` driving live components.

## Testing

- Every reader: a provider override reaches it; with no provider the constant applies.
- Selector isolation: a change to one path does not re-render a reader of another.
- `prefsDefaultsSource` against a store at defaults, compared by `prefsCss` output.
- The vite plugin in `forge-node` against a real server.
- Runtime adopt as a `*.browser.test`, reading the computed custom property — jsdom resolves no
  `var()`.

## TODO

The P1 is rewritten down to the remaining arcs as each lands and deleted with arc 6. The P3
"Nothing puts `prefsCss` on a page" is deleted when arc 5 lands.
