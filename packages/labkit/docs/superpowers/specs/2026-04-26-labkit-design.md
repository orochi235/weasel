# Labkit — Design Spec

**Date:** 2026-04-26
**Status:** Approved for implementation planning
**Package:** `@labkit/react`

## 1. Summary

Labkit is a React widget library for building **labs** — self-contained interactive HTML pages with sliders, controls, and canvas-based experimentation. The library extracts three patterns proven in the `garden-planner` repo (drag-lab workspace tiles, drag-lab quadtree layer reordering, and the main app's pan/zoom canvas stack), generalizes them, and ships them as composable widgets that agents can use to scaffold new labs.

The library is published as `@labkit/react` (Approach 1: single package, colocated examples). Source ships inside the package alongside the dist build so that agents reading `node_modules/@labkit/react/src/...` see real, readable code. Top-level `AGENTS.md` and per-widget `AGENTS.md` files map widgets to source paths and describe extension points.

## 2. Conceptual Model

```
Lab (page-level app)
 ├── registers Instruments (definitions of what can be experimented on)
 ├── owns cross-workspace state (saved snapshots, theme)
 └── hosts a WorkspaceGrid containing N
       Workspaces (UI tiles with chrome: toolbar, controls, save/load)
        └── runs one
             Experiment (live session: state, config values, undo history)
              └── instantiated from an Instrument
```

**Lab** — the application (one per HTML page). Owns the instrument registry, top-level chrome, theme, and shared state. Renders a workspace grid.

**Workspace** — a UI tile inside the Lab. Provides chrome (toolbar, controls panel, save/load) around one experiment. The "almost-identical windows" inside an app.

**Experiment** — the live session running inside a Workspace. Owns evolving state, current config values, undo history. An experiment is *instantiated from* an Instrument.

**Instrument** — a definition. Declares config schema, default state, render behavior, and which capabilities (canvas, layers, drag/drop, undo) the experiment supports. One Lab can register multiple Instruments; each Workspace picks one to run.

A Lab can register one or many Instruments. Workspace-level instrument selection is supported (drag-lab pattern: one tile shows Freeform, another shows Quadtree).

## 3. Repo Layout

```
labkit/
  src/
    lab/            # <Lab>, <LabShell>, <WorkspaceGrid>, theming integration
    workspace/      # <Workspace>, toolbar, controls, save/load chrome
    instrument/     # defineInstrument(), capability types, runtime
    canvas/         # <CanvasStack> primitive + canvas capability
    layers/         # <LayerList> primitive + layers capability
    controls/       # <ControlPanel>, ConfigField schema
    state/          # useExperimentState hook, storage adapters, undo
    theme/          # tokens, light.less, dark.less, base.less
    primitives/     # <Toolbar>, <Sidebar>, <StatusBar>, <FpsMeter>, <ScaleIndicator>
    index.ts        # public entry
    **/*.stories.tsx  # Storybook stories colocated with each component
  examples/
    drag-lab/       # port of garden-planner/src/drag-lab — proving ground
    minimal/        # smallest possible lab (one slider, one canvas)
  .storybook/
    main.ts         # Storybook config (react-vite builder)
    preview.tsx     # global decorators: theme toggle, base CSS import
  docs/
    AGENTS.md       # widget-to-source map for agent navigation
    RECIPES.md      # composition patterns
  dist/             # built output (gitignored)
  storybook-static/ # built Storybook output (gitignored)
  package.json
  tsconfig.json
  vite.config.ts    # dev server for examples (Storybook reuses)
  tsup.config.ts    # library build
  biome.jsonc
```

## 4. Build & Tooling

- **TypeScript:** strict mode, target ES2022, React 19 types
- **Library build:** tsup → ESM + .d.ts + plain CSS (LESS compiled at build time)
- **Examples build:** vite → static demo site
- **Component workshop:** Storybook 8.x with `@storybook/react-vite` builder (reuses the vite config)
- **Test:** vitest + @testing-library/react
- **Lint/format:** biome (inherits from `garden-planner` baseline)
- **Package manager:** npm (no monorepo tooling)

**Peer dependencies:**
```json
{ "react": "^19.0.0", "react-dom": "^19.0.0" }
```
Zustand is bundled, not a peer (implementation detail).

**Public entry points (package.json `exports`):**
```
@labkit/react              → Lab, Workspace, defineInstrument, top-level helpers
@labkit/react/canvas       → CanvasStack + canvas types
@labkit/react/layers       → LayerList + layers types
@labkit/react/controls     → ControlPanel + ConfigField
@labkit/react/primitives   → Toolbar, Sidebar, StatusBar, FpsMeter, ScaleIndicator
@labkit/react/state        → useExperimentState, storage adapters, undo helpers
@labkit/react/styles.css   → required base styles (lk-* prefix)
@labkit/react/theme-light.css
@labkit/react/theme-dark.css
@labkit/react/src/*        → exposed for agents reading source
```

`files: ["dist", "src", "AGENTS.md", "RECIPES.md", "README.md"]` ensures source ships in the published tarball.

## 5. Instrument Contract

```ts
interface Instrument<TState, TConfig> {
  name: string;

  // Required: declarative shape
  configSchema(): ConfigField[];
  defaultConfig(): TConfig;
  initialState(config: TConfig): TState;

  // Required: rendering — at least one of (render, canvas)
  render?: (ctx: RenderContext<TState, TConfig>) => ReactNode;

  // Optional capabilities — opt-in, each is a self-contained bundle
  canvas?: CanvasCapability<TState, TConfig>;
  layers?: LayerCapability<TState, TConfig>;
  dragDrop?: DragDropCapability<TState, TConfig>;
  undo?: UndoCapability<TState, TConfig>;

  // Optional lifecycle
  onConfigChange?: (config: TConfig, prev: TConfig, state: TState) => TState;
  serialize?: (state: TState) => unknown;
  deserialize?: (data: unknown) => TState;
}

function defineInstrument<TS, TC>(spec: Instrument<TS, TC>): Instrument<TS, TC>;
```

### Capability Shapes

```ts
interface CanvasCapability<TS, TC> {
  layers?: CanvasLayer<TS, TC>[];
  render?: (ctx: CanvasRenderingContext2D, state: TS, config: TC) => void;
  initialView?: { zoom: number; pan: { x: number; y: number } };
  hitTest?: (state: TS, worldPos: Point) => HitResult | null;
}

interface CanvasLayer<TS, TC> {
  id: string;
  label: string;
  render: (ctx: CanvasRenderingContext2D, state: TS, config: TC, view: ViewTransform) => void;
  alwaysOn?: boolean;
}

interface LayerCapability<TS, TC> {
  source?: 'canvas' | ((state: TS, config: TC) => LayerDescriptor[]);
}

interface DragDropCapability<TS, TC> {
  palette: PaletteItem[] | ((state: TS) => PaletteItem[]);
  onDragOver?: (pos: Point, dragged: PaletteItem, state: TS, config: TC) => DragFeedback | null;
  onDrop: (pos: Point, dragged: PaletteItem, state: TS, config: TC) => TS;
  pickUp?: (pos: Point, state: TS) => { item: PaletteItem; state: TS } | null;
}

interface UndoCapability<TS, TC> {
  snapshotOn: SystemEvent[];
  snapshot?: (state: TS, config: TC) => unknown;
  restore?: (data: unknown, current: { state: TS; config: TC }) => { state: TS; config: TC };
  maxDepth?: number; // default 50
}
```

### Render Context

```ts
interface RenderContext<TS, TC> {
  state: TS;
  config: TC;
  setState: (next: TS | ((prev: TS) => TS)) => void;
  setConfig: (key: keyof TC, value: unknown) => void;
  workspace: { id: string; zoom: number; setZoom: (z: number) => void };
  emit: (event: string) => void;       // for custom undo trigger events
}
```

State updates use **fresh-state updaters**, not Immer drafts. Instruments that want Immer can call `produce()` themselves; the library does not depend on it.

### Worked Example: Quadtree as an Instrument

```ts
const QuadtreeInstrument = defineInstrument<QuadtreeState, QuadtreeConfig>({
  name: 'Quadtree',
  configSchema: () => [
    { key: 'maxDepth', label: 'Max depth', type: 'slider', min: 1, max: 8, default: 5 },
    { key: 'opaqueBorders', label: 'Opaque borders', type: 'checkbox', default: false },
  ],
  defaultConfig: () => ({ maxDepth: 5, opaqueBorders: false }),
  initialState: () => ({ items: [], tree: null }),
  canvas: {
    layers: [
      { id: 'grid',    label: 'Grid',    render: renderGrid, alwaysOn: true },
      { id: 'cells',   label: 'Cells',   render: renderCells },
      { id: 'items',   label: 'Items',   render: renderItems },
      { id: 'overlay', label: 'Overlay', render: renderOverlay },
    ],
  },
  layers: { source: 'canvas' },
  dragDrop: {
    palette: defaultPalette,
    onDragOver: quadtreeDragOver,
    onDrop: quadtreeDrop,
  },
  undo: { snapshotOn: ['canvas.itemAdded', 'canvas.itemRemoved', 'layers.reorder'] },
});
```

## 6. Widgets

### Compound (capability-driven)

```tsx
<Lab
  instruments={[FreeformInstrument, QuadtreeInstrument]}
  defaultInstrument="Freeform"
  storage={localStorage}        // or null to disable
  storageKey="my-lab"
  theme="auto"                  // "light" | "dark" | "auto" (default)
  title="My Lab"
>
  {/* Optional children render in the LabShell header */}
</Lab>
```

`<Lab>` renders `<LabShell>` (header/body/footer slots), a `<WorkspaceGrid>`, and N `<Workspace>` children. Owns: workspace list, save slots, theme toggle, persistence wiring.

```tsx
<Workspace
  // Uncontrolled by default — pattern B from the brainstorming session.
  // The Lab manages state automatically.
  // Optional control overrides:
  config={...} onConfigChange={...}
  state={...} onStateChange={...}
/>
```

`<Workspace>` introspects the chosen Instrument and renders the appropriate chrome for each capability. The default toolbar (undo/redo/zoom/save/load/clone/reset/close) can be replaced via a `toolbar` render prop: `<Workspace toolbar={(ctx) => <MyToolbar {...ctx} />} />`. The same pattern applies to `sidebar` and `statusBar` slots.

### Primitives (escape-hatch — usable without Lab/Workspace)

| Primitive | Purpose |
|---|---|
| `<CanvasStack>` | Multi-layer canvas with pan/zoom; ports `garden-planner/src/canvas/CanvasStack` |
| `<LayerList>` | Reorderable layer legend with visibility checkboxes; supports `alwaysOn` items |
| `<ControlPanel>` | Schema-driven control rendering from `ConfigField[]` |
| `<Toolbar>` | Horizontal slot container; subcomponents `<Toolbar.Button>`, `<Toolbar.Spacer>`, `<Toolbar.Title>` |
| `<Sidebar>` | Vertical control container, collapsible |
| `<StatusBar>` | Footer for status text |
| `<LabShell>` | Page-level chrome (header/body/footer) with theme application |
| `<WorkspaceGrid>` | Auto-tiling grid; cols = ⌈√n⌉, rows = ⌈n/cols⌉ |
| `<FpsMeter>` | Frame-rate display |
| `<ScaleIndicator>` | Pan/zoom-aware ruler; reads view from CanvasStack context if present |

`<CanvasStack>` is ported from the existing `garden-planner` implementation as the v0 starting point, then trimmed of garden-planner-specific renderers (planting/structure/zone). The pan/zoom/multi-layer/hit-testing core stays.

`<WorkspaceGrid>` uses fixed sqrt-tiling. No drag-to-resize panes or docking layouts in v0.

## 7. State, Persistence, Undo

### Internal Stack

One Zustand store per `<Lab>` instance, holding `{ workspaces, savedSnapshots, theme }` plus actions. Multiple Labs on one page have isolated state. The store is an implementation detail — consumers reach for `useExperimentState()` (workspace-scoped via context) or the controlled-component props.

### Per-Workspace Record

```ts
interface WorkspaceRecord<TS, TC> {
  id: string;
  instrumentName: string;
  config: TC;
  state: TS;
  view: { zoom: number; pan: { x: number; y: number } };
  // Internal — not persisted:
  undoStack: UndoStack;
}
```

### Persistence

```ts
interface StorageAdapter {
  read(key: string): string | null;
  write(key: string, value: string): void;
}
```

Built-in adapters:
- `labkit.storage.localStorage` (default)
- `labkit.storage.sessionStorage`
- `labkit.storage.urlHash` — serializes state into the URL fragment
- `labkit.storage.memory` — for tests
- `labkit.storage.none` — disables persistence

The Lab namespaces under its `storageKey`: `lk:<storageKey>:workspaces` and `lk:<storageKey>:saves`. An Instrument's `serialize`/`deserialize` hooks let it control how its state survives a refresh; default is `JSON.stringify` / `JSON.parse`.

**Persistence boundary:** `workspaces` (full state) and `savedSnapshots` (named save slots) persist. `undoStack` is session-only.

### Undo (Opt-In Capability)

```ts
type SystemEvent =
  | 'state.change'          // any setState call
  | 'config.change'         // any setConfig call
  | 'config.change:<key>'   // specific config field
  | 'layers.reorder'
  | 'layers.toggle'
  | 'canvas.itemAdded'      // emitted when dragDrop.onDrop returns new state
  | 'canvas.itemRemoved'
  | string;                 // custom events emitted via ctx.emit('foo')
```

The library emits system events as actions happen; the Instrument's `undo.snapshotOn` lists which events trigger snapshots. An Instrument with no `undo` capability gets no undo, and the Workspace toolbar hides the undo/redo buttons.

Default snapshot is `structuredClone(state)`; `undo.snapshot` and `undo.restore` allow custom serialization (e.g., diff-based snapshots for large states).

### Save/Load Slots

Lab-level. Each save captures `{ instrumentName, config, state }` for one workspace at a moment in time. Persisted alongside workspaces under `lk:<storageKey>:saves`.

## 8. Theming & Styling

### Class-Name Convention

All labkit DOM uses the `lk-` prefix (`lk-workspace`, `lk-toolbar`, etc.). Enforced by a small pre-commit script (`scripts/check-class-prefix.ts`) that scans `src/**/*.tsx` for `className=` literals not starting with `lk-`. Runs in CI as well.

### CSS Variable Tokens

```less
// src/theme/tokens.less — the contract (dark is the base; @media handles light)
:root {
  // Surface
  --lk-bg, --lk-bg-elevated, --lk-bg-canvas, --lk-border, --lk-divider
  // Text
  --lk-text, --lk-text-muted, --lk-text-disabled
  // Accent / interactive
  --lk-accent, --lk-accent-hover, --lk-focus-ring
  // Sizing
  --lk-radius, --lk-radius-sm, --lk-control-height
  --lk-spacing-xs, --lk-spacing-sm, --lk-spacing-md, --lk-spacing-lg
  // Typography
  --lk-font, --lk-font-mono, --lk-font-size, --lk-font-size-sm
  // Z-layers
  --lk-z-toolbar, --lk-z-overlay, --lk-z-modal
}

@media (prefers-color-scheme: light) {
  :root { /* light overrides */ }
}
```

### Theme Selection

`<Lab theme>` defaults to `"auto"`:
- `"auto"` — follow `prefers-color-scheme`, including runtime OS changes (no JS listener needed; CSS media query handles it)
- `"light"` — force light by attaching `.lk-theme-light` to LabShell (higher specificity beats the media query)
- `"dark"` — force dark via `.lk-theme-dark`

Consumers using primitives directly (no `<Lab>`) get OS-following behavior automatically when they import `@labkit/react/styles.css`.

### Authoring & Build

- Source authored in LESS (nesting, variables in source)
- Build (tsup + PostCSS) compiles LESS to plain CSS
- Three CSS files ship: `dist/styles.css` (base + components), `dist/theme-light.css`, `dist/theme-dark.css`
- LESS files colocate with their component (`Workspace.less` next to `Workspace.tsx`)

### Authoring Rules

- All `className=` literals in `src/` must match `/^lk-/`
- No inline styles in `src/` except for view transforms (canvas zoom/pan, grid template counts)

## 9. Testing & Component Workshop

### Tests

| Layer | What | Examples |
|---|---|---|
| Pure functions | Geometry, schema validation, undo stack ops, storage adapters | `pushSnapshot`, `gridDims`, `validateConfigSchema` |
| Hooks | `useExperimentState`, per-Lab Zustand store, undo runtime | snapshot-on-event, restore-from-snapshot, max-depth eviction |
| Components | Primitives in isolation with controlled props | `<LayerList>` reorder, `<ControlPanel>` for all `ConfigField` types |
| Integration | One full Lab+Instrument flow per major capability | drag-drop instrument: drop, undo, redo, save, load, clone |

Coverage target: **70%+ for `src/`**, with attention to state-machine code. Snapshot tests avoided.

### Storybook

Every primitive ships with at least one `*.stories.tsx` file colocated with its source. Stories double as visual review surfaces and as inputs for interaction tests via `play` functions.

**Setup:**
- Storybook 8.x with `@storybook/react-vite` (reuses the project's existing vite config)
- Global decorator in `.storybook/preview.tsx` imports `src/theme/base.less` and the dark/light token files; toolbar control toggles `lk-theme-light` / `lk-theme-dark` on the preview root
- Addons: `@storybook/addon-essentials`, `@storybook/addon-interactions`, `@storybook/addon-a11y`

**Scripts:**
- `npm run storybook` — dev server on :6006
- `npm run build-storybook` — static build to `storybook-static/` for hosting alongside the examples site

**Story coverage v0:** Each primitive in section 6 gets a Default story plus one variant story (e.g., `<LayerList>` with `alwaysOn` items, `<ControlPanel>` showing all `ConfigField` types). Compound widgets (`<Lab>`, `<Workspace>`) get one Default story each but the heavier proving ground stays in `examples/`.

## 10. Agent-Facing Docs

`AGENTS.md` (root) — widget-to-source map and "when to use what" guidance.

Per-widget `AGENTS.md` — props, extension points, and "what to copy if you fork."

`RECIPES.md` — composition patterns covering at minimum:
- Build a parameter-explorer lab (sliders only, no canvas)
- Build a drag-and-drop layout lab (drag-lab equivalent)
- Build a layered visualization lab (canvas + layer toggles)
- Add a custom undoable action via `ctx.emit(...)`
- Persist to URL hash instead of localStorage

## 11. Out of Scope (v0)

- CI release pipeline (manual `npm publish` from main)
- Drag-to-resize panes, docking layouts (`<WorkspaceGrid>` is fixed sqrt-tiling)
- Runtime theme switching beyond `<Lab theme>` (no theme builder UI)
- Plugin/extension registry (capabilities are typed object fields; can be subsumed later without API breakage)
- Immer integration (instruments can use it internally if they want)

## 12. Versioning

- v0.x — every minor release potentially breaking
- v1.0 stabilizes the Lab/Workspace/Instrument/capability contracts

## 13. Open Questions

(None blocking. Items here are deferred decisions that don't gate v0 implementation.)

- Whether `<CanvasStack>` should expose its internal interaction hooks (`useMoveInteraction`, `useResizeInteraction`, etc.) as a public sub-API in v0.x or wait for v0.y once a second lab consumes them.
- How `<WorkspaceGrid>` should behave at high N (>16 workspaces). Fixed-grid breakdown threshold? Pagination? TBD when a real lab hits the limit.
- Whether to ship a "lab CLI" (`npx create-lab`) for scaffolding new lab repos. Defer until labkit has at least one external consumer.
