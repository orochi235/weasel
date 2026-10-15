# Kit settings implementation plan

> **For agentic workers:** each arc below is one worktree and one branch, merged to `main` on a green
> `npm run test:fleet`. Read the spec first.

**Goal:** kit-wide settings read through one store, written as prefs schema groups, optionally emitted as CSS custom properties.

**Architecture:** a settings store and provider in `@weasel-js/react`; each package augments `KitSettings` with its area and reads `useKitSetting(path) ?? CONSTANT` (React) or a `store.get(path)` thunk (outside React); each package that owns an area exports a prefs schema group whose defaults are those constants; `@weasel-js/prefs` gains a schema-only CSS source, a vite plugin, and a store → provider bridge.

**Spec:** `docs/superpowers/specs/2026-10-15-kit-settings-design.md`

## Global constraints

- Every changeset is `patch`.
- Defaults live only in the existing constants; a schema group imports them, never restates the number.
- `KitSettings` is augmented with `declare module '@weasel-js/react' { interface KitSettings { … } }` from the package that owns the area, in a file the package's barrel loads.
- No new frame loops; no `requestAnimationFrame`.
- Files stay under 400 lines, functions under 120 (`npm run check:size`).
- Tests run under the root config: `npx vitest run --project=<name> <path>`; `npm run check:test-projects` names the project.
- `npm run typecheck` and `npm run check:imports` pass before each commit that touches a package's imports.

## Review focus

- A reader mounted with no provider behaves exactly as before (constant applies).
- A provider value changed mid-gesture reaches the next press, not the current one's already-captured value.
- A component's own prop still beats a provider (`<SceneCanvas longPress>`, a leaf's `debounceMs`).
- `prefsCss` output for kit settings never collides with a theme token (`--wzl-kit-` prefix).
- A schema group's default equals the constant it imports (one test per group comparing them).

## Interfaces (from arc 1, landed)

```ts
// @weasel-js/react
export interface KitSettings {}                          // augmented per area
export type KitSettingsOverrides<T = KitSettings>;       // deep-partial tree
export type KitSettingPath<T = KitSettings>;             // 'tree.typeaheadMs'
export type KitSettingAt<P, T = KitSettings>;
export interface KitSettingsStore { get(path): value | undefined; subscribe(fn): () => void }
export function createKitSettingsStore(overrides?, parent?): WritableKitSettingsStore;
export const NO_KIT_SETTINGS: KitSettingsStore;
export function KitSettingsProvider(props: { value: KitSettingsOverrides; children }): ReactNode;
export function useKitSettings(): KitSettingsStore;      // for thunks
export function useKitSetting(path): value | undefined;  // re-renders on that path only
```

## Areas and their owners

| Area (key in `KitSettings`) | Leaves | Owner: augments + exports schema group | Constant(s) |
|---|---|---|---|
| `gestures` | `doubleClickMs`, `doubleClickPx`, `longPressMs`, `tapPx`, `dragPx` | augment + group in `core` (gestures has no deps) | `gestures/src/recognizer/thresholds.ts`, `gestures/src/ui/dragThreshold.ts` |
| `numberField` | `repeatDelayMs`, `repeatEveryMs` | `ui` | `NumberField/UnitField.tsx` |
| `params` | `form`/`panel`/`lab` × `textWaitMs`, `settles.{number,slider,string,color}` | `ui` | `Prefs/commitPolicy.ts` |
| `tree` | `typeaheadMs`, `hoverExpandMs`, `tipRestMs` | `ui` | `Tree/Tree.tsx`, `Tree/useTreeDrag.ts`, `Tree/useRowTip.ts` |
| `help` | `focusDelayMs` | `ui` | `Properties/rowHelp.ts` |
| `toast` | `ttlMs` | `ui` | `Toast/queue.ts` |
| `targets` | hit / snap radii, overlay dot sizes (one leaf per distinct constant, camelCased) | `core` for core's, `ui` for ui's (`targets` is merged from both augmentations — keys must not overlap) | `core/device/targets.ts` and the `*_HIT_PX` / `*_SNAP_PX` / `*_RADIUS_PX` / tolerance constants |
| `view` | `animationMs` | `core` | `core/viewport/useViewAnimation.ts` |
| `history` | `coalesceMs` | `ui` (`PrefSchemaEditor`, `Badge` lab) — forge's stays a constant | `COALESCE_MS` |
| `orbit3d` | `orbitRate`, `dollyRate` | `kernel3d` | `kernel3d/src/tools.ts` |
| `loupe` | `wheelRate` | `labkit` | `labkit/src/loupe/loupeActions.ts` |

`params` is nested per surface rather than split by a `params.surface` enum, as the spec first said: a
split leaf is chosen by one global selection, and a surface is a property of the component, varying
within one page.

Schema group exports: `uiKitSettingsSchema` (ui), `coreKitSettingsSchema` (core), `kernel3dKitSettingsSchema`,
`labkitKitSettingsSchema`. Each is a `PrefGroup` whose children are keyed by area, so an app composes
`pref.group('Kit', { ...ui.children, ...core.children })` and paths match `KitSettings` paths exactly.
Number leaves carry units (`{ suffix: 'ms' }`, `{ suffix: 'px' }`) and sane `min`/`max`.

## Arc 1 — store and provider (`@weasel-js/react`) — done in this branch

Files: `packages/react/src/kitSettings.ts`, `useKitSetting.ts`, `kitSettings.test.tsx`, barrel.

## Arc 2 — ui areas

- [ ] Augment `KitSettings` with `numberField`, `params`, `tree`, `help`, `toast`, ui's `targets` and `history` in `packages/ui/src/kitSettings.ts`, loaded by the barrel.
- [ ] Each reader: `useKitSetting('<path>') ?? CONSTANT`; non-component code (`Toast/queue.ts`, `commitPolicy.ts` tables) takes the value as a parameter from the component that has the hook. `PARAMS_SETTLES` / `PARAMS_TEXT_WAIT_MS` stay exported as the defaults.
- [ ] For each reader, a test: provider override reaches it; no provider → constant.
- [ ] `uiKitSettingsSchema` with a test that every leaf's default equals its constant and its paths are all valid `KitSettingPath`s.
- [ ] Changeset (patch) for `@weasel-js/ui`.

## Arc 3 — gestures

- [ ] `gestures`: `createPointerRecognizer` options gain `doubleClickMs`, `doubleClickPx`, `tapPx`, `dragPx` thunks shaped like `longPressMs`; `click.ts`, `multiTouch.ts`, `pastDragThreshold` callers read them, constant as fallback.
- [ ] `routing` pointer channel fills them from the kit settings store (a ref of `useKitSettings()` held by the dispatcher), alongside `longPressMs`; an explicit `longPress` prop still wins.
- [ ] `core` augments `gestures` and exports its group in `coreKitSettingsSchema`.
- [ ] Tests: recognizer honors each thunk; dispatcher under a provider recognizes a double click at the overridden interval.

## Arc 4 — targets, view, history, rates

- [ ] Core hit / snap / dot constants read through a thunk on the store the canvas already holds (pass `useKitSettings()` into the context actions and layers read; `core/device/targets.ts` multiplies its device scale onto the setting).
- [ ] `useViewAnimation`: `useKitSetting('view.animationMs') ?? (reduced motion ? 0 : DEFAULT_MS)`.
- [ ] `kernel3d` `orbit3d`, `labkit` `loupe` areas and groups.
- [ ] Tests per reader as in arc 2.

## Arc 5 — CSS output and the bridge (`@weasel-js/prefs`)

- [ ] `prefsDefaultsSource(schema): PrefsCssSource` in `packages/prefs/src/defaultsSource.ts`; test: `prefsCss(prefsDefaultsSource(s))` equals `prefsCss` over `openPrefsSync(s, memory)` for a schema with plain, split and nested leaves.
- [ ] `kitSettingsCssOptions(at?: string): PrefsCssOptions` naming properties `--wzl-kit-<path kebab>` (dropping the `at` prefix).
- [ ] `@weasel-js/prefs/vite`: `weaselPrefsCss({ schemas: Record<moduleId, exportName>, css?: PrefsCssOptions })` serving `virtual:weasel-prefs.css` via `runnerImport`; HMR invalidation on schema module change; package `exports` entry + build entry. Test in `forge-node` against a real vite server.
- [ ] `@weasel-js/prefs/react`: `<KitSettingsFromPrefs store at? css?>` — renders `KitSettingsProvider` with `prefValueAtPath(store.values(), at)`; with `css`, adopts `prefsCss(store, kitSettingsCssOptions(at))` into the root's sheet and sets `prefsCssAttributes`, re-run on store change, released on unmount. `*.browser.test` reads a computed custom property.
- [ ] Delete the P3 "Nothing puts `prefsCss` on a page".

## Arc 6 — lab

- [ ] A lab composing the schema groups into one `Prefs` page beside a Tree, a NumberField and a canvas, all driven by `<KitSettingsFromPrefs>`.
- [ ] Delete the P1, this plan, and the spec (moving anything durable into `docs/conventions.md` → "Kit settings").
