# Pref schema editor

> **Status: designed, not built.** Delete this file once the last arc below merges.

A development tool for editing preference *schemas* — which prefs exist, how
they nest, and each leaf's attributes (kind, label, default, bounds, control,
options) — with a live preview of the result. For weasel developers shaping a
settings surface; not an end-user preferences UI. It answers "what should this
schema be?" by letting you change it and watch `PrefsDialog` render it.

Edits live in a scratch copy and leave as a TypeScript literal you paste back
into source. Writing back to source files is out of scope; the export format is
the literal such a write-back would produce, so it can be added later without
changing the format.

## What it edits

Every schema is a core `ToolPrefGroup` (`packages/core/src/tools/prefs.ts`):
groups nest, leaves are `ToolPref` or `ToolPrefCustom`. The draw dev page loads
from:

| Source | Where |
|---|---|
| WeaselDraw's preferences, including tool prefs (`tools.pen` is `usePenTool.prefs`) | `PREFS`, `apps/draw/src/prefs.ts` |
| Each node kind's property schema | `defaultNodeProperties` (`@weasel-js/core`) |

## Arcs

Each lands on its own, with a `patch` changeset for any package change.

### 1. Finish the `WeaselDrawPref` port

Core's `ToolPref*` family was extracted from draw's `WeaselDrawPref*` and has
since gained everything draw's has, except `registry-enum`. Draw still declares
its own copy. Redefine draw's types over core's:

- `number`, `boolean`, `string`, `enum` → core's `ToolPref*`.
- `registry-enum` → a `ToolPrefCustom` carrying `source` and `filter`.
- draw's `object` is an opaque value with no `children` (`ui.panels`), which
  core's `ToolPrefObject` is not — it becomes a custom kind `'data'`, rendered
  by the same control. Stored values are unaffected; only the descriptor's
  `kind` changes.
- `WeaselDrawPrefGroup` → `ToolPrefGroup` (or an alias of it).

`typeof PREFS` must still drive `WeaselDrawPrefPath`, and `PreferencesModal`
must render unchanged.

### 2. Drag-to-reorder in `Tree`

`Tree` (`packages/ui/src/components/Tree`) gains drag and keyboard moves,
**off unless `onMove` is given**:

```ts
interface TreeDropTarget {
  parentId: string | null;   // null = top level
  index: number;             // among parentId's children, pre-drag
}

// on TreeProps
onMove?(ids: string[], target: TreeDropTarget): void;
canDrop?(ids: readonly string[], target: TreeDropTarget): boolean;
```

- A drop into a dragged node or its descendants is always refused; `canDrop`
  refuses further and defaults to allowing everything else. There are no
  modes: siblings-only, leaves-only-in-groups and the like are all a
  `canDrop`.
- Drop zones: a row's top and bottom quarters mean before/after it; the middle
  half of a branch row means into it, appended. Below the last visible row of a
  subtree, the pointer's x picks the level — after the row, or after any
  ancestor whose subtree ends there. Hovering a collapsed branch
  ~600ms expands it. A refused target shows no indicator; releasing there
  cancels.
- Feedback: an insertion line indented to the target level, or a highlighted
  branch for an into-drop; the dragged rows ride `DragGhost`.
- Keyboard: Alt+↑/↓ moves among siblings; Alt+←/→ outdents/indents (indent
  makes the node the last child of the sibling above). Each goes through
  `canDrop`.
- Multi-select: dragging a selected row drags the selection in tree order; a
  node whose ancestor is also selected travels with that ancestor.
- `Tree` stays controlled — it never reorders `nodes`; the consumer applies the
  move.

**One drop model.** `useReorderDragList` (`packages/ui/src/useReorderDragList.ts`)
resolves a pointer to an index in a flat list. Generalize its core to resolve to
a `TreeDropTarget`, and make the flat list the one-parent case: it maps
`{ parentId: null, index }` onto its existing `onReorder(ids, index)`. Its
signature and its callers (`ItemList`, `LayerList`, `DataGrid`,
`PropertyGroup`) do not change, and its existing tests must pass unmodified.
Moving `LayerList` onto the tree core is not part of this work.

### 3. Schema model: `schemaEdit`, `schemaExport`, `kindSchemas`

Pure modules in `packages/ui/src/components/PrefSchemaEditor/`, no React.

- **`schemaEdit`** — immutable edits on a `ToolPrefGroup`, each returning a new
  tree: add leaf/group, remove, rename key, move (to a `TreeDropTarget`), set an
  attribute, change kind. Changing kind keeps the base fields and drops
  attributes the new kind lacks.
- **`schemaExport`** — two outputs:
  - the tree as a TS object literal, keys in tree order, only fields that are
    set. Any function-valued field — `encoding`, `fromScalar`, a predicate
    `filter`, and `unit` (which holds `toDisplay`) — prints as
    `KEEP_FROM_SOURCE`, an undeclared identifier, so the pasted literal fails
    typecheck until the original expression is restored.
  - a change list against the loaded schema: `+` added, `−` removed, `↕` moved
    (old path → new path), `~` attribute changed (old → new), including
    attributes dropped by a kind change.
- **`kindSchemas`** — one attribute schema per built-in kind, itself a
  `ToolPrefGroup`, plus the base fields every leaf shares (`name`,
  `description`, `default`, `hidden`, `block`, `icon`, `pair`, `short`). The
  editor edits a leaf's attributes by rendering its kind's attribute schema
  with `PrefsForm`. Enum `options` need a list editor (`ListEditor`) as a
  custom renderer.

### 4. `PrefSchemaEditor`

A `@weasel-js/ui` component:

```ts
interface PrefSchemaEditorProps {
  schema: ToolPrefGroup;
  onChange(next: ToolPrefGroup): void;
  /** Baseline for the change list. Defaults to the first `schema` seen. */
  original?: ToolPrefGroup;
  /** Attribute schemas for custom kinds, by kind. */
  kinds?: Record<string, ToolPrefGroup>;
  /** Passed to the preview's PrefsForm. */
  renderers?: PrefsFormProps['renderers'];
}
```

Three panes and a drawer:

| Pane | Built from | Does |
|---|---|---|
| Structure | `Tree` with `onMove` | Keys and groups; add/remove/rename from a toolbar; drag and keyboard moves. `canDrop` refuses drops into a leaf. Changed rows are marked. |
| Attributes | `PrefsForm` over `kindSchemas` | The selected node's attributes. Function-valued fields show as read-only "code" rows. |
| Preview | `PrefsForm` | The edited schema, live, against scratch values seeded from defaults. |
| Export drawer | `Tabs` + `Code` | "Literal" and "Changes" tabs, each with Copy. |

A leaf whose kind has no attribute schema (an unregistered custom kind) edits
its base fields only.

### 5. Draw dev page `#/dev/prefs`

`apps/draw/src/dev/PrefSchemaPage.tsx`, framed by `DevShell` and listed in
`DEV_PAGES` and `CommandBar`'s dev entries. A source picker lists `PREFS` and
each `defaultNodeProperties` kind; picking one loads a fresh working copy. The
page supplies `registry-enum`'s attribute schema and preview renderer (reusing
`PreferencesModal`'s). Working copies are in memory only — switching source or
reloading discards them.

## Testing

| What | How |
|---|---|
| `schemaEdit`, `schemaExport` | Unit tests (`weasel-ui` project). Round trip: export, evaluate the literal with `KEEP_FROM_SOURCE` stubbed, compare to the edited tree. |
| Tree drop model | Unit tests of target resolution and `canDrop` against fixed row geometry. |
| `Tree` drag | `Tree.browser.test.tsx` — pointer geometry needs real layout. |
| `useReorderDragList` | Existing tests, unmodified, must pass. |
| Port (arc 1) | Typecheck plus existing `PreferencesModal` / `prefs` tests. |
| Editor, page | Story for `PrefSchemaEditor`; screenshot of `#/dev/prefs`. |
