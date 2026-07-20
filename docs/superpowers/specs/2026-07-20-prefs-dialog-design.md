# PrefsForm / PrefsDialog — kit-level preferences UI

**Date:** 2026-07-20
**Status:** approved in discussion; this document is the reference for the implementation plan.

## Goal

Lift WeaselDraw's `PreferencesModal` into `@weasel-js/ui` as a proper, schema-driven
preferences surface, so consumers stop hand-rolling the registry-walk + control-mapping
boilerplate (per the demo-conventions rule: consumer boilerplate the kit could absorb is a
signal to hoist it).

## Background

- Core already owns the schema vocabulary for tool-contributed prefs:
  `src/tools/prefs.ts` (`ToolPref*`, `ToolPrefGroup`) — number / boolean / string / enum
  leaves with `control` presentation hints (renamed from `expression`, 2026-07-20),
  `hidden`, `description`, `default`, and nestable groups. It is documented as a
  *structural subset* of whatever a host app defines.
- WeaselDraw's `prefs.ts` defines the superset (`registry-enum`, `object` kinds) plus a
  localStorage-backed store (`usePref`, dotted paths, persisted nested value mirror).
- WeaselDraw's `PreferencesModal.tsx` (~330 lines) walks the registry inside a kit
  `Dialog`: top-level groups → columns, nested groups → indented sub-panels, each leaf
  kind → a kit control.

## Design

### Components (new folder `packages/ui/src/components/Prefs/`)

**`PrefsForm`** — the foundation. Schema in, controls out, no storage opinion:

```ts
interface PrefsFormProps {
  schema: PrefGroup;                    // root group
  values: unknown;                      // nested value tree (matches persisted mirrors)
  onChange: (path: string, value: unknown) => void;  // dotted path
  renderers?: Record<string, PrefRenderer>;          // per-kind extensions/overrides
  showHidden?: boolean;                 // reveal `hidden` leaves (default false)
  className?: string;
}

type PrefRenderer = (ctx: PrefRenderContext) => ReactNode;
interface PrefRenderContext {
  path: string;          // dotted path of the leaf
  pref: PrefLeaf;        // schema node (app kinds see their own shape)
  value: unknown;
  setValue: (v: unknown) => void;
}
```

**`PrefsDialog`** — thin composition: kit `Dialog` + title + optional `headerExtra`
slot (hosts app chrome like WeaselDraw's dev-only "Show hidden" switch) + `PrefsForm`.
Props = `PrefsFormProps` + `isOpen` / `onOpenChange` / `title` / `headerExtra`.

### Schema (`packages/ui/src/components/Prefs/schema.ts`)

Kit-owned `Pref*` family, field-compatible with core's `ToolPref*` so
`ToolPrefGroup` is structurally assignable with no import and no cast
(`packages/ui` does not depend on `@weasel-js/core`; this is deliberate and mirrors
how `composeToolPrefs` works today):

- `PrefNumber` (`min`/`max`/`step`, `control?: 'input' | 'slider'`)
- `PrefBoolean` (`control?: 'checkbox' | 'switch'`)
- `PrefString` (`control?: 'input' | 'textarea'`)
- `PrefEnum` (`options`, `control?: 'select' | 'radio'`)
- `PrefGroup` (`name`, `description?`, `children: Record<string, Pref | PrefGroup>`)
- Common: `kind`, `name`, `description`, `default`, `hidden?`.

`PrefLeaf` is open: nodes whose `kind` isn't built in are legal and dispatch to
`renderers[kind]`. Unknown kind with no renderer → labeled "(no renderer)" row, not a
crash.

### Extensibility: renderer map, not render-functions in schema

App-specific kinds stay *data* in the schema (`registry-enum` nodes keep `source`/
`filter`); behavior arrives via the `renderers` prop. Renderer entries take precedence
over built-in kinds when keys collide (per-app control replacement for free).
WeaselDraw wires:

- `'registry-enum'` → `RegistrySelect` (app component, unchanged)
- `'object'` → switch on `ctx.path` (`ui.panels` → `PanelsEditor`, else read-only row)

### Value binding

Controlled only (`values` + `onChange(path, value)`). WeaselDraw adapts by
subscribing to its store root (`useSyncExternalStore`) and calling its existing
`setPref` on change. A `PrefsStore` adapter interface is explicitly deferred until a
real re-render cost appears.

### Layout & chrome

- Top-level groups → columns; nested groups → indented sub-panels. Ported from
  `wd-prefs-*` CSS into `Prefs.module.css` on `wzl-` tokens.
- Leaf rows: label + control; `description` becomes a kit `Tooltip` on the label
  (native `title=` is banned per the ActionBar migration).
- Timing/motion uses the theme motion tokens.

### Out of scope (deliberate)

- Storage. The kit never touches localStorage.
- Tabs layout for groups (future `layout` prop if wanted).
- Search/filter, dirty-state, OK/Cancel semantics — changes apply live via `onChange`.
- Migrating core's `ToolPref*` to import from ui (structural compatibility is the contract).

## Migration (apps/draw)

`PreferencesModal.tsx` shrinks to ~40 lines: `PrefsDialog` + `renderers` map +
dev-mode `headerExtra` switch + `visibleSubtree` deletion (kit owns `hidden`
filtering via `showHidden`). `prefs.ts` unchanged. `wd-prefs-*` CSS deleted except
any app-specific bits.

## Testing

- Schema→control mapping per kind (including `control` hint variants).
- Renderer-map dispatch: unknown kind, override of built-in kind, ctx contents.
- `hidden` filtering incl. empty-group pruning (ports `visibleSubtree` behavior).
- `onChange` paths for nested groups.
- Storybook story with a representative schema (all kinds + a custom kind).
