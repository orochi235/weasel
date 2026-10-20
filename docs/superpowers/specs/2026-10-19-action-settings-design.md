# Actions carry a settings form

**Status: designed 2026-10-19, unbuilt.** For whoever plans and builds it. Answers: how an action
whose job is "change these settings on the selection" shows up on every surface that lists actions.

## Why

Some actions only make sense with params: `configureWarp` remakes the selection's warps under new
settings, `editPathEffect` lays new settings over the selected path effects. A surface that lists
actions draws each as a button that calls `registry.trigger(id)` with no params, so these do
nothing. Draw's Path bar shows exactly that: a Warp Settings button whose click commits nothing,
live even with no warp selected (`docs/TODO.md`, "Draw's Warp Settings button does nothing").

Chosen over a per-app popover in the style of draw's Corner shape (2026-10-19): an app wiring its
own popover per action repeats for every such action, and the action's entry on the Path bar stays
a dead button.

## Goals

- An `Action` can declare a settings form: what to show, the current values read from its deps,
  and the params a change makes.
- Every surface that lists actions draws such an action as its form instead of a bare trigger:
  bar, panel, menu, and command palette.
- `configureWarp` declares its form and an `enabled`; draw's Path bar then opens Warp Settings as
  a working popover with no draw-side code.
- `editPathEffect` declares its form too — the second adopter, which is what shows the field is
  general rather than shaped to warps.

## Non-goals

- A new form renderer. The form is a `PrefGroup` drawn by `PrefsForm` and by the menu resolver's
  existing value rows.
- Changing how variants work. An action with variants and settings is not a case this has to
  serve; it may refuse the combination.

## Anti-goals

- A drag across a slider in the form leaving one undo step per frame. One drag is one undo step.
- A form that shows defaults as though they were the selection's values. With nothing applicable
  selected the entry is disabled, and where selected items disagree the field shows mixed.

## The field

On `ActionPresentation` (`packages/routing/src/interactions/actions/action.ts`; routing already
depends on `@weasel-js/prefs`):

```ts
interface ActionSettings {
  /** The form. Its `name` titles the popover, submenu or dialog. */
  schema: PrefGroup;
  /** The selection's current values, by leaf path, and the paths where the
   *  selected items disagree. Under `enabled`'s contract: pure, fast, no throw. */
  read(deps: ActionDeps): { values: Record<string, unknown>; mixed?: readonly string[] };
  /** The params one field's change triggers the action with. Default: `{ [path]: value }`. */
  params?(path: string, value: unknown): Record<string, unknown> | null;
}
```

`read` gets the same deps bag `enabled` does, through `buildDepsFromRequires`. Values stay current
the way `useActionStates` keeps `enabled` current: subscribe to the dep registry's `changed()` and
re-read.

The entry is disabled whenever `enabled` says so, with the reason shown as other entries show it.

## Per surface

| Surface | Entry draws as | A change |
|---|---|---|
| Bar (`BarActionOne` / `useLeafAction`) | The action's button, opening a `BarPopover` holding `PrefsForm` `layout="list"` | triggers with `params(path, value)` |
| Panel (`PrefActionButton` / `PrefActionRows`) | The same button and popover as the bar | same |
| Menu (`resolveSchemaMenu`) | A submenu of the schema's leaves as the menu's existing value rows (`number`, `text`, and whatever enum/boolean rows the resolver already makes); values read when the menu opens | same, menu stays open |
| Command palette (`usePaletteItems`) | A row as now; choosing it opens the form in a `PrefsDialog` titled by the schema's name | same |

All four go through one hook that, given an action, returns `{ schema, values, mixed, onChange,
disabledReason }`, so no surface derives values or params on its own.

## Undo

Every surface draws the form under the `form` params surface (`PARAMS_SETTLES.form` in
`packages/ui/src/components/Prefs/commitPolicy.ts`), which writes a slider or a typed number only
when the edit settles. So one edit is one `onChange`, one trigger, one undo step, with no
coalescing. Coalescing is not the mechanism: draw's history has no `coalesceWindowMs`, so a
`coalesceKey` there merges nothing.

The canvas does not follow a slider mid-drag. Making it follow (drafts through `withDrafts`, kept
out of undo, or through the action's `preview`) is a later addition, not part of this.

## The two adopters

**`configureWarp`** (`packages/path-tools/src/warp/warpActions.ts`). `enabled` matches
`expandWarp`'s: `NotApplicable` unless a selected path holds a warp. The form, each section shown
only while the selection holds that kind (`showIf` on a hidden count leaf, as `CORNER_CONTROLS`
gates on `count`):

- Distort: Mode (Free, Perspective), params `{ kind: 'distort', mode }`
- Envelope: Rows, Columns, mapping, params `{ kind: 'envelope', … }`
- Every kind: Tolerance

Values read through `resolvePathWarp`; mixed where selected warps differ.

**`editPathEffect`** (`packages/path-tools/src/pathEffects/actions.ts`). Its form has one section
per effect kind, shown while the selection holds that kind, with the fields of `BlendEffect`,
`BendAlongEffect` and `RepeatAlongEffect` minus `kind`. Leaf paths carry the kind (`blend.steps`),
and `params()` turns one into `{ kind: 'blend', steps }`. The action gains an optional `kind`
param, as `configureWarp` has, limiting an edit to effects of that kind: without it, Orient changed
in the Blend section would also change a selected Repeat Along, since both have the field
(design call, 2026-10-19). It also gains `selection` in `requires` and an `enabled` that is
`NotApplicable` without a selected path effect, as `expandPathEffect` has. It has no `group`, so in
draw it surfaces through the palette.

## Left to the builder

- Converting `read`'s flat values to the nested tree `PrefsForm` takes.
- Where the shared hook lives (ui, beside `useLeafAction`, is the obvious place) and its name.
- How `read`'s output is snapshotted for `useSyncExternalStore`.
- Exact control choices per field (slider vs input for tolerance, ranges, steps).
- Whether `BarPopover` grows a disabled-reason tooltip to match `BarActionButton`, or the entry
  wraps it.

## Done means

- Draw: select a distorted path, open Path → Warp Settings, switch Mode; the path refits, one undo
  step. With no warp selected the entry is disabled.
- The same through the Path asset shown as a menu and as a panel, and through the palette.
- `editPathEffect` through the palette changes a blend's steps.
- The TODO entry for the dead button is retired, and this spec deleted, in the merge.
