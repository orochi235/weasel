# Lab/Workspace Runtime — Design Spec

**Date:** 2026-04-27
**Status:** Draft (unattended Claude default — review before implementation)
**Depends on:** Plan 1 (Foundation), Plan 2 (state-runtime)
**Builds toward:** Plan 4 (instruments), Plan 5 (capabilities)
**Package paths:** `src/lab/Lab.tsx`, `src/workspace/`, `@labkit/react`

---

## 1. Summary

This subsystem wires the compound components that turn Plan 1's presentational primitives and Plan 2's Zustand store into a working lab application. The main deliverables are:

- **`<Lab>`** — page-level provider. Owns the instrument registry, per-Lab Zustand store, workspace list, save slots, and theme application. Renders `<LabShell>` + `<WorkspaceGrid>`.
- **`<Workspace>`** — a single tile in the grid. Renders chrome (toolbar, sidebar, status bar) around an Experiment. Default toolbar includes undo/redo/zoom/save/load/clone/reset/close, with capability gating.
- **Workspace lifecycle operations** — add, clone, close, reset.
- **Slot system** — `toolbar`, `sidebar`, `statusBar` render props on `<Workspace>`; `header`/`footer` children/render props on `<Lab>`.
- **View state** — per-workspace `{ zoom, pan }` stored in the Plan 2 store and exposed via `useExperimentState`.
- **Theme application** — `<Lab theme>` applies `lk-theme-light` / `lk-theme-dark` on the `<LabShell>` root per design spec §8.
- **Minimal example** — `examples/minimal/` with one stub instrument.

This subsystem deliberately contains no instrument internals (Plan 4), no capability machinery (Plan 5), and no storage adapter implementations (Plan 2). It imports Plan 2's public surface and stays behind the `Instrument` type boundary from design spec §5.

---

## 2. Public API

### 2.1 Components

```tsx
// Top-level lab provider
<Lab
  instruments={Instrument[]}           // required; at least one — CLAUDE'S DEFAULT: throw if empty array
  defaultInstrument={string}           // required; name of instrument shown in the first workspace on fresh mount
  storage={StorageAdapter | null}      // optional; null → labkit.storage.none — CLAUDE'S DEFAULT
  storageKey={string}                  // optional; default "labkit" — CLAUDE'S DEFAULT
  theme={"auto" | "light" | "dark"}   // optional; default "auto"
  title={string}                       // optional; forwarded to LabShell header
>
  {children}   {/* ReactNode — rendered in the LabShell header slot */}
</Lab>

// Workspace tile
<Workspace
  id={string}                     // assigned by Lab; not set by consumers directly
  // Uncontrolled by default; Lab manages state via Plan 2 store
  config={TC}                     // optional controlled override
  onConfigChange={(tc: TC) => void}
  state={TS}                      // optional controlled override
  onStateChange={(ts: TS) => void}
  toolbar={(ctx: WorkspaceToolbarContext) => ReactNode}  // replaces default toolbar
  sidebar={(ctx: WorkspaceSidebarContext) => ReactNode}  // replaces default sidebar
  statusBar={(ctx: WorkspaceStatusBarContext) => ReactNode}
/>
```

`<Workspace>` is not rendered directly by consumers. It is created by `<Lab>` for each entry in the workspace list and also exposed for slot composition. Consumers who want a custom toolbar call the Lab-level `addWorkspace(instrumentName, opts)` API or use the default toolbar's "add" affordance.

### 2.2 Hooks

```ts
// Already defined in Plan 2; used here for completeness
import { useExperimentState } from '../state';

// Lab-level context access (new in Plan 3)
import { useLabContext } from '../lab/LabContext';

const {
  instruments,           // Instrument[] — registered instruments
  workspaces,            // WorkspaceRecord[] — live workspace list
  addWorkspace,          // (instrumentName: string) => void
  cloneWorkspace,        // (id: string) => void
  closeWorkspace,        // (id: string) => void
  resetWorkspace,        // (id: string) => void
  savedSlots,            // SaveSlot[]
  saveToSlot,            // (workspaceId: string, label?: string) => void
  loadFromSlot,          // (workspaceId: string, slotId: string) => void
  theme,                 // 'auto' | 'light' | 'dark'
  setTheme,              // (t: 'auto' | 'light' | 'dark') => void — CLAUDE'S DEFAULT: exposed for runtime toggle
} = useLabContext();
```

`useLabContext()` throws if called outside a `<Lab>`. This is intentional.

### 2.3 Types

```ts
// Re-exported from Plan 2; shown here for reference
interface WorkspaceRecord<TS = unknown, TC = unknown> {
  id: string;
  instrumentName: string;
  config: TC;
  state: TS;
  view: { zoom: number; pan: { x: number; y: number } };
  // undoStack is internal; not exposed via context
}

interface SaveSlot {
  id: string;
  label: string;
  instrumentName: string;
  config: unknown;
  state: unknown;
  savedAt: number; // epoch ms
}

// New in Plan 3
interface WorkspaceToolbarContext {
  workspaceId: string;
  instrumentName: string;
  hasUndo: boolean;          // true when instrument.undo capability is present
  canUndo: boolean;          // true when undoStack has entries — CLAUDE'S DEFAULT: always false in Plan 3; Plan 5 fills in
  canRedo: boolean;
  undo: () => void;          // no-op in Plan 3; Plan 5 implements
  redo: () => void;
  zoom: number;
  setZoom: (z: number) => void;
  zoomIn: () => void;        // zoom * 1.25 — CLAUDE'S DEFAULT
  zoomOut: () => void;       // zoom * 0.8 — CLAUDE'S DEFAULT
  resetZoom: () => void;     // zoom → 1.0 — CLAUDE'S DEFAULT
  hasCanvas: boolean;        // true when instrument.canvas capability is present; gates zoom controls — CLAUDE'S DEFAULT
  savedSlots: SaveSlot[];
  saveToSlot: (label?: string) => void;
  loadFromSlot: (slotId: string) => void;
  clone: () => void;
  reset: () => void;
  close: () => void;
  isLastWorkspace: boolean;  // when true, close button is disabled — CLAUDE'S DEFAULT
}

interface WorkspaceSidebarContext {
  workspaceId: string;
  instrumentName: string;
  // Instrument's configSchema and config values for building a control panel
  configFields: ConfigField[];
  config: unknown;
  setConfig: (key: string, value: unknown) => void;
}

interface WorkspaceStatusBarContext {
  workspaceId: string;
  instrumentName: string;
  zoom: number;
  // consumers may add arbitrary status content via statusBar render prop
}
```

### 2.4 Source module map

| File | Role |
|---|---|
| `src/lab/Lab.tsx` | `<Lab>` component |
| `src/lab/LabContext.ts` | React context + `useLabContext()` |
| `src/lab/LabContext.test.ts` | unit tests for `useLabContext` guard |
| `src/lab/Lab.test.tsx` | integration tests |
| `src/lab/Lab.stories.tsx` | Storybook stories |
| `src/lab/index.ts` | re-exports (extend Plan 1's existing `src/lab/index.ts`) |
| `src/workspace/Workspace.tsx` | `<Workspace>` component |
| `src/workspace/WorkspaceChrome.tsx` | default chrome composition (toolbar + sidebar + status bar) |
| `src/workspace/DefaultToolbar.tsx` | default toolbar implementation |
| `src/workspace/workspaceOps.ts` | pure functions: `addWorkspace`, `cloneWorkspace`, `closeWorkspace`, `resetWorkspace` |
| `src/workspace/workspaceOps.test.ts` | unit tests |
| `src/workspace/Workspace.less` | component styles |
| `src/workspace/Workspace.test.tsx` | component tests |
| `src/workspace/Workspace.stories.tsx` | Storybook stories |
| `src/workspace/index.ts` | re-exports |
| `examples/minimal/main.tsx` | Vite entry |
| `examples/minimal/index.html` | HTML shell |
| `examples/minimal/StubInstrument.ts` | one-slider stub instrument |
| `examples/minimal/MinimalLab.tsx` | top-level `<Lab>` usage |

---

## 3. Component Hierarchy

```
<Lab>
  [creates LabContext with store from Plan 2]
  <LabShell theme={resolvedThemeClass}>
    <LabShell.Header>
      {title && <Toolbar.Title>{title}</Toolbar.Title>}
      {children}            ← consumer's Lab header content
    </LabShell.Header>

    <LabShell.Body>
      <WorkspaceGrid count={workspaces.length}>
        {workspaces.map(ws =>
          <Workspace key={ws.id} id={ws.id} ...>
            <WorkspaceChrome workspaceId={ws.id} instrument={resolvedInstrument}>
              [toolbar slot]
              DefaultToolbar | toolbar(ctx)

              [body]
              <Sidebar>  ← sidebar slot
                DefaultSidebar | sidebar(ctx)
              </Sidebar>

              [experiment area]
              instrument.render(renderCtx)   ← Plan 4 provides RenderContext wiring

              [status bar slot]
              DefaultStatusBar | statusBar(ctx)
            </WorkspaceChrome>
          </Workspace>
        )}
      </WorkspaceGrid>
    </LabShell.Body>
  </LabShell>
</Lab>
```

Note: In Plan 3, `instrument.render` is called but the full `RenderContext` wiring (canvas capability, dragDrop, etc.) is Plan 4's responsibility. Plan 3 passes a minimal `RenderContext` with `state`, `config`, `setState`, `setConfig`, and `workspace.{ id, zoom, setZoom }`. The `emit` function is a no-op stub until Plan 5.

---

## 4. `<Lab>` — Props, Lifecycle, Mounting/Unmounting

### 4.1 Props

| Prop | Type | Required | Default | Notes |
|---|---|---|---|---|
| `instruments` | `Instrument[]` | yes | — | **CLAUDE'S DEFAULT:** throws at runtime if empty |
| `defaultInstrument` | `string` | yes | — | Name of instrument for the initial workspace |
| `storage` | `StorageAdapter \| null` | no | `labkit.storage.localStorage` | **CLAUDE'S DEFAULT:** `null` maps to `labkit.storage.none` (skip persistence) |
| `storageKey` | `string` | no | `"labkit"` | **CLAUDE'S DEFAULT** |
| `theme` | `"auto" \| "light" \| "dark"` | no | `"auto"` | |
| `title` | `string` | no | `undefined` | Forwarded to LabShell header |
| `children` | `ReactNode` | no | `undefined` | Rendered in the LabShell header slot |

### 4.2 Mount sequence

1. Validate `instruments` (non-empty; names are unique). **CLAUDE'S DEFAULT:** throw a descriptive error synchronously in development (`process.env.NODE_ENV !== 'production'`); in production, fall back to the first instrument silently if `defaultInstrument` name doesn't match.
2. Call `createLabStore(instruments, storage, storageKey)` from Plan 2.
3. Hydrate from storage: if persisted workspaces exist under `lk:<storageKey>:workspaces`, restore them. Otherwise create one workspace using `defaultInstrument`. **CLAUDE'S DEFAULT:** if persisted workspaces reference an instrument that is no longer registered, skip that workspace and log a console warning.
4. Wrap children in `LabContext.Provider` with the store instance and derived actions.
5. Apply theme (see §8).

### 4.3 Unmount

The per-Lab Zustand store is destroyed when `<Lab>` unmounts (created via `createLabStore` returning a scoped store instance). No global store state leaks between Lab instances or between test runs.

### 4.4 `defaultInstrument` resolution

**CLAUDE'S DEFAULT decision:** On first mount (no persisted state), the first workspace always uses `defaultInstrument`. If storage has persisted workspaces from a prior session, those are restored as-is; `defaultInstrument` is NOT used to override them. This matches the principle of least surprise — a lab reloads where the user left off.

---

## 5. `<Workspace>` — Props, Default Chrome Composition, Slot Contract

### 5.1 Internal vs. externally authored `<Workspace>`

`<Workspace>` is rendered by `<Lab>` internally. Consumers do not render `<Workspace>` directly — they control workspace composition through:
- `addWorkspace(instrumentName)` / `cloneWorkspace(id)` on `useLabContext()`
- The `toolbar`, `sidebar`, `statusBar` render props on the Lab-level `<Lab>` (applied to all workspaces) — **CLAUDE'S DEFAULT:** Lab-level slot defaults act as fallbacks; per-workspace overrides are not exposed in Plan 3. Per-workspace slot overrides are deferred.

### 5.2 Default chrome composition

```
lk-workspace (outermost div)
  lk-workspace__toolbar
    <DefaultToolbar ctx={WorkspaceToolbarContext} />
  lk-workspace__body
    lk-workspace__sidebar
      <DefaultSidebar ctx={WorkspaceSidebarContext} />
    lk-workspace__content
      {instrument.render(renderCtx)}
  lk-workspace__status
    <DefaultStatusBar ctx={WorkspaceStatusBarContext} />
```

### 5.3 Default toolbar contents

Rendered left-to-right:

| Item | Condition | Keyboard shortcut |
|---|---|---|
| Undo button | `ctx.hasUndo === true` | `Cmd/Ctrl+Z` — **CLAUDE'S DEFAULT** |
| Redo button | `ctx.hasUndo === true` | `Cmd/Ctrl+Shift+Z` — **CLAUDE'S DEFAULT** |
| `<Toolbar.Spacer />` | always | — |
| Zoom out button | `ctx.hasCanvas === true` | `Cmd/Ctrl+Minus` — **CLAUDE'S DEFAULT** |
| Zoom level display (read-only text) | `ctx.hasCanvas === true` | — |
| Zoom in button | `ctx.hasCanvas === true` | `Cmd/Ctrl+Equal` — **CLAUDE'S DEFAULT** |
| Reset zoom button | `ctx.hasCanvas === true` | `Cmd/Ctrl+0` — **CLAUDE'S DEFAULT** |
| `<Toolbar.Spacer />` | always | — |
| Save button | always | `Cmd/Ctrl+S` — **CLAUDE'S DEFAULT** |
| Load dropdown trigger | `ctx.savedSlots.length > 0` | — |
| `<Toolbar.Spacer />` | always | — |
| Clone button | always | — |
| Reset button | always | — |
| Close button (disabled when `isLastWorkspace`) | always | — |

**CLAUDE'S DEFAULT — zoom controls when no canvas:** zoom buttons are hidden (not disabled) when `hasCanvas` is false. Rationale: a non-canvas instrument has no meaningful pan/zoom; showing disabled controls would be confusing.

**CLAUDE'S DEFAULT — keyboard shortcuts scope:** shortcuts are scoped to the focused workspace only (the workspace that last received a click or focus event). This avoids Cmd+Z in one workspace triggering undo in another. Scoping implementation: capture keyboard events on the `lk-workspace` div with `tabIndex={0}` and `onKeyDown`.

### 5.4 Default sidebar

When an instrument's `configSchema()` returns a non-empty array, the default sidebar renders a `<ControlPanel configFields={...} config={...} setConfig={...} />`. Plan 4 defines `<ControlPanel>`; in Plan 3, stub with a placeholder `<div className="lk-sidebar__placeholder" />` when `ControlPanel` is not yet available. **CLAUDE'S DEFAULT.**

### 5.5 Default status bar

Shows `{instrumentName} · {Math.round(zoom * 100)}%` by default. **CLAUDE'S DEFAULT.**

---

## 6. Workspace Operations

All operations are pure functions in `src/workspace/workspaceOps.ts` that operate on `WorkspaceRecord[]`. The Lab store (Plan 2) calls these and persists the result.

### 6.1 `addWorkspace`

```ts
function addWorkspace(
  workspaces: WorkspaceRecord[],
  instruments: Instrument[],
  instrumentName: string,
): WorkspaceRecord[]
```

- Finds the named instrument; throws if not found.
- Creates a new `WorkspaceRecord` with:
  - `id`: `crypto.randomUUID()`
  - `instrumentName`: as given
  - `config`: `instrument.defaultConfig()`
  - `state`: `instrument.initialState(instrument.defaultConfig())`
  - `view`: `instrument.canvas?.initialView ?? { zoom: 1, pan: { x: 0, y: 0 } }` — **CLAUDE'S DEFAULT**
- Returns new array with the workspace appended.

### 6.2 `cloneWorkspace`

```ts
function cloneWorkspace(
  workspaces: WorkspaceRecord[],
  id: string,
): WorkspaceRecord[]
```

- Deep-clones the source record via `structuredClone`.
- Assigns a new `id` (`crypto.randomUUID()`).
- Inserts the clone immediately after the source in the array.
- `view` is also cloned (zoom/pan are preserved). **CLAUDE'S DEFAULT.**

### 6.3 `closeWorkspace`

```ts
function closeWorkspace(
  workspaces: WorkspaceRecord[],
  id: string,
): WorkspaceRecord[]
```

- **CLAUDE'S DEFAULT:** if `workspaces.length === 1`, returns the array unchanged (no-op; close button is disabled in the UI). This prevents an empty workspace grid.
- Otherwise, removes the workspace with the given `id`.

### 6.4 `resetWorkspace`

```ts
function resetWorkspace(
  workspaces: WorkspaceRecord[],
  id: string,
  instruments: Instrument[],
): WorkspaceRecord[]
```

- Finds the workspace by `id`.
- Resets `config` to `instrument.defaultConfig()`.
- Resets `state` to `instrument.initialState(defaultConfig)`.
- Resets `view` to `instrument.canvas?.initialView ?? { zoom: 1, pan: { x: 0, y: 0 } }`.
- Does NOT change `instrumentName` — reset is "back to defaults", not "change instrument". **CLAUDE'S DEFAULT.**
- Returns a new array with the updated record.

---

## 7. Slot Render Props

### 7.1 `toolbar` slot

```ts
type ToolbarSlot = (ctx: WorkspaceToolbarContext) => ReactNode;
```

`WorkspaceToolbarContext` is defined in §2.3 above. The render prop completely replaces the default toolbar; there is no "extend default toolbar" API in Plan 3. **CLAUDE'S DEFAULT — composition pattern:** if a consumer wants to extend rather than replace, they import `<DefaultToolbar>` from `@labkit/react` and spread `ctx` onto it.

`<DefaultToolbar>` is exported as a named export so custom toolbar render props can include it.

### 7.2 `sidebar` slot

```ts
type SidebarSlot = (ctx: WorkspaceSidebarContext) => ReactNode;
```

`WorkspaceSidebarContext` is defined in §2.3. The render prop replaces the default sidebar contents; the outer `<Sidebar>` frame (collapse chevron, width) is still rendered by `<WorkspaceChrome>`. **CLAUDE'S DEFAULT.**

### 7.3 `statusBar` slot

```ts
type StatusBarSlot = (ctx: WorkspaceStatusBarContext) => ReactNode;
```

Replaces the default status bar content. The outer `<StatusBar>` frame is still rendered by `<WorkspaceChrome>`.

### 7.4 Lab-level `header` / `footer`

`<Lab>` `children` are rendered in `LabShell.Header`. There is no `footer` prop in Plan 3; `LabShell.Footer` remains empty. **CLAUDE'S DEFAULT — footer deferred** until a concrete use case surfaces.

### 7.5 Slot propagation

Slots are passed at the `<Lab>` level and applied uniformly to all workspaces:

```tsx
<Lab
  toolbar={(ctx) => <MyToolbar {...ctx} />}
  sidebar={(ctx) => <MyControls {...ctx} />}
  statusBar={(ctx) => <MyStatus {...ctx} />}
  ...
/>
```

This is the Plan 3 API. Per-workspace slot overrides are deferred to a future plan. **CLAUDE'S DEFAULT.**

---

## 8. Theme Application

Follows design spec §8 exactly:

| `theme` prop | DOM effect |
|---|---|
| `"auto"` (default) | No class added to `<LabShell>`; CSS media query `@media (prefers-color-scheme: light)` governs |
| `"light"` | `.lk-theme-light` added to the `<LabShell>` root div |
| `"dark"` | `.lk-theme-dark` added to the `<LabShell>` root div |

Implementation: `<Lab>` passes a computed `themeClass` prop to `<LabShell>`. `<LabShell>` merges it onto its root div. The `lk-theme-light` / `lk-theme-dark` rules use higher specificity than the `@media` block so they win at any viewport condition.

`setTheme` from `useLabContext()` updates the store; `<Lab>` re-renders `<LabShell>` with the new class. **CLAUDE'S DEFAULT — runtime theme switching:** `setTheme` is intentionally exposed so a theme toggle button in the header can switch it without requiring a prop change from the outside.

---

## 9. Example: Minimal Lab

### File tree

```
examples/minimal/
  index.html           # Vite entry HTML; imports main.tsx
  main.tsx             # ReactDOM.createRoot + <MinimalLab />
  MinimalLab.tsx       # <Lab instruments={[StubInstrument]} defaultInstrument="Stub" ...>
  StubInstrument.ts    # defineInstrument stub — one slider config, no canvas
```

### `StubInstrument.ts` (spec — no code)

- `name`: `"Stub"`
- `configSchema()`: returns one `ConfigField` of type `"slider"`, key `"value"`, range 0–100, default 50.
- `defaultConfig()`: `{ value: 50 }`
- `initialState(config)`: `{ doubled: config.value * 2 }`
- `render(ctx)`: returns a `<div>` displaying `ctx.state.doubled`. No canvas.

### `MinimalLab.tsx` (spec — no code)

Renders:
```tsx
<Lab
  instruments={[StubInstrument]}
  defaultInstrument="Stub"
  storageKey="minimal-lab"
  title="Minimal Lab"
>
  {/* no header children */}
</Lab>
```

The sidebar shows the "value" slider (via `<ControlPanel>` stub or placeholder). The toolbar shows Save/Load/Clone/Reset/Close. No undo buttons (no `undo` capability). No zoom controls (no `canvas` capability).

### Vite dev server

`npm run dev` (root `vite.config.ts`) serves `examples/minimal/index.html` as the default entry. **CLAUDE'S DEFAULT — single entry point:** Plan 3 uses minimal as the sole Vite entry. The drag-lab example entry is added in a later plan when `examples/drag-lab/` is built.

---

## 10. Testing Strategy

### Unit tests

| File | What to test |
|---|---|
| `workspaceOps.test.ts` | `addWorkspace`, `cloneWorkspace`, `closeWorkspace` (no-op on last), `resetWorkspace` — all happy paths + edge cases |
| `LabContext.test.ts` | `useLabContext()` throws when called outside `<Lab>` |

### Component tests (vitest + @testing-library/react)

| File | Scenarios |
|---|---|
| `Lab.test.tsx` | Renders without crashing; renders one workspace by default; applies `lk-theme-light` class when `theme="light"`; throws on empty `instruments` array |
| `Workspace.test.tsx` | Renders default toolbar; hides undo buttons when instrument has no `undo`; disables close when only one workspace; close removes workspace when >1 exist; clone appends a workspace |

### Integration tests

| Scenario | File |
|---|---|
| Full add/clone/close cycle with `StubInstrument` | `Lab.test.tsx` — integration section |
| Reset returns config + state to defaults | `Lab.test.tsx` |
| Theme class toggled by `setTheme` | `Lab.test.tsx` |

### Coverage target

70%+ for `src/lab/` and `src/workspace/` (inherited from design spec §9).

### Storybook

- `Lab.stories.tsx`: one Default story using `StubInstrument`; one variant with two workspaces.
- `Workspace.stories.tsx`: rendered inside a mock `LabContext.Provider` to show the toolbar in isolation.

---

## 11. Open Decisions (CLAUDE'S DEFAULT — review)

1. **`instruments` empty array:** throw synchronously in dev; no-op in prod (currently: throw always).
2. **`storage: null` semantics:** maps to `labkit.storage.none` (no persistence). Alternative: map to `labkit.storage.memory` for in-session persistence. Current default: `none`.
3. **Zoom controls when no canvas:** hidden entirely. Alternative: show disabled (greyed out). Current default: hidden.
4. **Close last workspace:** disabled (button grayed, no-op). Alternative: replace workspace with a placeholder "empty" tile. Current default: disabled.
5. **`defaultInstrument` on hydration:** persisted workspaces override it; `defaultInstrument` is only used when there is no prior session. Alternative: always reset to `defaultInstrument` on mount. Current default: persisted wins.
6. **Keyboard shortcut scope:** shortcuts fire only when the workspace div has focus. Alternative: global Cmd+Z always targets the most-recently-active workspace. Current default: focus-scoped.
7. **Lab-level vs. per-workspace slot overrides:** Plan 3 only supports lab-level (uniform across all workspaces). Per-workspace overrides deferred.
8. **`setTheme` exposure:** exposed on `useLabContext()` for runtime toggle. Alternative: theme is prop-only (no runtime mutation). Current default: exposed.
9. **View state cloned on clone:** zoom/pan are preserved on workspace clone. Alternative: reset view to defaults on clone. Current default: preserved.
10. **Stubs for Plan 4 surface:** `instrument.render` is called directly with a minimal `RenderContext`; `ControlPanel` sidebar is a placeholder `<div>`. These are explicitly provisional and will be replaced by Plan 4.
11. **`storageKey` default:** `"labkit"`. Multiple `<Lab>` instances on the same page with no explicit `storageKey` will collide. **Recommendation:** make `storageKey` required in a future breaking change, or validate uniqueness at mount time.

---

## 12. Out of Scope

- `defineInstrument()` implementation and `RenderContext` full wiring (Plan 4)
- `<CanvasStack>`, `<LayerList>`, canvas capability integration (Plan 5)
- Undo/redo machinery — buttons surface in Plan 3 but are no-ops (Plan 5)
- Storage adapter implementations — `labkit.storage.*` (Plan 2)
- Per-workspace slot overrides (deferred)
- Lab footer slot (deferred)
- `<ControlPanel>` schema-driven rendering (Plan 4)
- Drag-to-resize panes / docking (design spec §11)
- Runtime theme builder UI (design spec §11)
- `npx create-lab` CLI (design spec §13)
