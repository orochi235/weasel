# SelectionPanel + NodeProperties trait — design

Date: 2026-07-20
Status: design, ready to plan.
Prereq reading: `2026-05-24-node-traits-reframe-design.md` (trait taxonomy,
convergence policy).

## Goal

Ship the pre-baked, extensible selection properties panel every consumer
ends up hand-rolling: shows the selected object's kind and its editable
properties, handles multi-selection (including mixed kinds and mixed
values), and works out of the box for the kit's built-in shape kinds.

Two deliverables:

1. **Core**: the `NodeProperties` trait registry — the `NodePropertyRows`
   slot reserved by the traits spec, renamed (the value is a schema, not
   row contributors) — plus `defaultNodeProperties` covering
   `KIT_SHAPE_KINDS`.
2. **UI**: `<SelectionPanel>` in `@weasel-js/ui`, consuming the trait.

## Non-goals

- No ActionsRegistry coupling in the panel (scrub/ongoing live preview is
  reachable via custom renderers; first-class support is future work).
- No context auto-wiring (`<SelectionPanel />` with zero props inside a
  provider). v1 takes explicit props; sugar can come later.
- No `NodeLabel` trait. Kind display labels are derived (title-case) with
  a prop override; per-kind label registries stay future work per the
  traits spec.
- No persistence, no panel chrome policy (collapse/hide stays the
  consumer's `SidebarPanel` concern).

## Part 1 — core: the `properties` trait

Per the traits-spec convergence policy:

1. **Trait name**: `properties`.
2. **Registry name**: `NodeProperties` (entry type `NodePropertiesEntry`).
   Supersedes the speculative `NodePropertyRows` name in the traits spec:
   the stored value is a declarative schema, not render contributors.
3. **Registry shape**: `Map<kindName, NodePropertiesEntry>` behind the
   same API surface as `NodeRouting`: `createNodeProperties()` returning
   `{ register, get, list }`. Entry:

   ```ts
   interface NodePropertiesEntry {
     /** Kind name — same vocabulary as the routing trait. */
     name: string;
     /** Property schema for this kind. */
     schema: ToolPrefGroup;
   }
   ```

   The schema **reuses** the existing `ToolPrefGroup` / `ToolPref` types
   (`src/tools/prefs.ts`) directly — no parallel types, no aliases; a new
   `ToolPrefLeaf` union adds an open `ToolPrefCustom` member (mirror of
   ui's `PrefCustom`) — extended per "Schema-type additions" below. **Leaf keys are dotted node paths** (`pose.x`,
   `pose.width`, `data.fill`, `data.text`) so generic
   read/aggregate/write needs no per-kind code. Groups render as panel
   sections (`Layout`, `Appearance`).
4. **Consumer**: `<SelectionPanel>` in `@weasel-js/ui` (and any consumer
   that wants to reflect editable properties — future command palette,
   inspector).
5. **Wiring**: module-level constants + explicit prop, exactly like
   routing. Core exports `defaultNodeProperties: readonly
   NodePropertiesEntry[]` (schemas for every `KIT_SHAPE_KINDS` kind:
   Layout = `pose.x/y/width/height/rotation`; Appearance =
   `data.fill/stroke/strokeWidth`; `data.text` for the text kind), kept
   in lockstep with `KIT_SHAPE_KINDS` the same way `defaultNodeRouting`
   is. Also `inferredNodeProperties` for the inferred routing kinds
   (`text` / `path` / `image`) — the vocabulary consumers like WeaselDraw
   actually produce when they rely on `inferredNodeRouting`. Consumers
   spread their own entries after either.
6. **Inspector surface**: `RegistryInspector` gains a `'properties'`
   child under `'traits'`, listing kinds and their schema leaf paths.

### Schema-type additions

Three core additions to the `ToolPref*` family, usable by tool prefs
too:

- **`ToolPrefColor extends ToolPrefBase<'color', string>`** — value is
  `#rrggbb` or `#rrggbbaa`; `alpha?: boolean` opts into the alpha
  slider. `ToolPref*` today has no color type.
- **`pair?: string` presentation hint** on the leaf base — leaves
  sharing a `pair` id render on one row (e.g. `pose.x`/`pose.y` →
  "Position", `pose.width`/`pose.height` → "Size").
- **Unit display transform on number leaves** — `RectPose.rotation` is
  radians (absent === 0) but the panel shows degrees. The number leaf
  gains a display-conversion hint (exact shape decided at plan time:
  likely `unit?: { toDisplay, fromDisplay, suffix }`); the stored value
  stays canonical.

## Part 2 — ui: `<SelectionPanel>`

`packages/ui` imports `@weasel-js/core` resolved the way the apps do —
repo-wide tsconfig `paths` + `weaselAliases` (no package.json entry while
ui is `private`; a real peer dependency is deferred to if/when ui
publishes). The barrel comment's "no scene-aware panels" rule is amended: scene-aware components are allowed when they are
generic over consumer data — what stays out is app-specific policy.

### Props

```ts
interface SelectionPanelProps<TData, TLayer extends string, TPose> {
  scene: Scene<TData, TLayer, TPose>;          // useScene handle (reactive)
  selection: Pick<SelectionApi, 'current'>;     // useSelection handle
  properties: readonly NodePropertiesEntry[];   // e.g. defaultNodeProperties
  routing: readonly NodeRoutingEntry[];         // required — pass the canvas's list
  renderers?: Record<string, PropertyRenderer>; // keyed by leaf PATH (checked
                                                // first) or leaf kind; null
                                                // collapses the row
  kindLabel?: (kind: string) => string;         // default: title-case
  emptyState?: ReactNode;                       // rendered when nothing selected
  className?: string;
}
```

The panel renders bare (sections + rows); consumers wrap it in
`SidebarPanel` (or not). `routing` and `properties` should be
module-level constants or memoized, matching the `SceneCanvas routing`
prop convention.

### Resolution pipeline (per render)

1. `selection.current` → nodes via `scene.get` (drop dead ids).
2. Classify each node: `kind === 'container'` → `'group'`; else
   routing-classify its `data`.
3. Effective schema: one kind → its registered schema; several kinds →
   **intersection** of their schemas by (leaf path, leaf kind). Kinds
   with no registered schema contribute an empty schema (intersection
   collapses accordingly; a lone unregistered kind shows header only).
4. Aggregate values per leaf path across nodes: all strictly equal →
   that value; else the `MIXED` sentinel (exported symbol).
5. Header: single node → kind label; multiple → `"N selected"` + kind
   breakdown (`rect ×2 · text`).

Steps 2–4 are pure functions (`classifyKind`, `effectiveSections`,
`aggregateValue`, plus `splitNodePath`) exported for testing and reuse.

### Rendering

- Sections from top-level groups (uppercase section titles), compact
  grid rows: label column + value cell(s). Paired leaves the schema
  marks as an axis pair (e.g. `pose.x`/`pose.y` — a `pair?: string`
  hint on the leaf) share one row.
- Built-in leaf renderers map to existing ui controls: number →
  `NumberField` (compact variant), boolean → `Switch`, string →
  `Input`, enum → `Select`, color → new **`ColorField`** component
  (lifted from WeaselDraw's `PropertyColorInput`, stripped of its
  actions-registry coupling: `value`, `onChange`, `alpha?`).
- Mixed values: text fields show a `Mixed` placeholder (italic, muted);
  `ColorField` shows a checkered chip. First edit replaces the mixed
  state and fans out.
- `renderers` map overrides/extends built-ins with the PrefsForm
  contract, context widened with mixed-awareness. Keys are leaf paths
  (checked first — lets `data.fill` and `data.stroke` differ) or leaf
  kinds:

  ```ts
  type PropertyRenderer = (ctx: {
    path: string;
    pref: ToolPrefLeaf;
    value: unknown;      // aggregated; undefined when mixed
    mixed: boolean;
    setValue: (v: unknown) => void;  // fans out + batches
  }) => ReactNode;       // null collapses the row
  ```

### Write path

`setValue(path, v)` commits one labeled undo step:

```ts
scene.batch(`Edit ${leafName}`, () => {
  for (const id of selectedIds) {
    if (path starts with 'pose.')  scene.setPose(id, { ...node.pose, [key]: v });
    else /* 'data.' */             scene.update(id, { data: { ...node.data, [key]: v } });
  }
});
```

Commit triggers: Enter/blur/stepper for text+number, change for
switch/select, change-end for color. One edit = one undo step across the
whole selection — fixing the first-node-only pose bug in today's
WeaselDraw inspector.

Paths are two-segment (`pose.x`, `data.fill`) in v1; deeper paths are a
schema-validation error until a use case shows up.

## Part 3 — WeaselDraw migration

Replace the hand-rolled object branch of `RightSidebar`
(`apps/draw/src/App.tsx`) with `<SelectionPanel>`:

- Routing: `inferredNodeRouting` (WeaselDraw doesn't tag `data.kind`);
  properties: `inferredNodeProperties`.
- Fill/opacity keep their ActionsRegistry begin/update/end behavior via
  path-keyed `renderers` overrides (`data.fill` / `data.stroke`) — this
  proves the escape hatch and preserves drag-coalesced live color
  preview.
- The document branch (filename/paper/background) stays a sibling
  branch inside the same `SidebarPanel`; `emptyState` renders the
  "No selection" note.
- Delete the now-dead inline inspector JSX (~170 lines) and any
  `PropertiesPanel` row primitives that stop being referenced;
  primitives still used elsewhere stay.

## Testing

- Pure functions: `intersectSchemas` (homogeneous, heterogeneous,
  unregistered kind, leaf-kind conflict on same path), `aggregateValues`
  (equal, mixed, missing), classification (container → `'group'`).
- Component (vitest + RTL, real `createScene`): renders kind header +
  fields for single selection; mixed selection shows intersection +
  `Mixed` placeholders; editing a field updates all selected nodes in
  one undo step (assert via scene history); empty state slot renders;
  custom renderer override wins over built-in.
- Trait registry: duplicate-name throw, `defaultNodeProperties` ↔
  `KIT_SHAPE_KINDS` parity test (mirror of the routing parity test).
- Gate: `tsc --noEmit && vitest run && tsup build`.

## Open questions resolved

1. **Where does it live?** `@weasel-js/ui`, which gains a core peer dep.
   (A separate `@weasel-js/inspector` package was considered and
   rejected in favor of one UI home.)
2. **Registry value shape?** Declarative schema per kind, not row
   contributors. Registry renamed `NodeProperties` accordingly.
3. **Mixed-kind selections?** Automatic schema intersection with
   per-field `MIXED` indeterminate state; no consumer-authored common
   schema required.
4. **Kind labels?** Derived (title-case) + `kindLabel` prop; no label
   field in the registry (traits stay single-axis).
5. **Ongoing/scrubbable edits?** Out of v1; reachable via custom
   renderers (WeaselDraw's color rows demonstrate it).
