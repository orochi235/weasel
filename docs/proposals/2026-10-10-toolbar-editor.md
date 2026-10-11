# A toolbar is a group drawn as a bar

**Unbuilt, but for the dispatchers' surface argument.** Written 2026-10-10 on branch
`toolbar-editor`. For whoever builds it. It says what has to change for `PrefSchemaEditor` to lay
out toolbars as well as settings forms, and in what order.

## What was decided

- **One schema.** A toolbar is a `PrefGroup` drawn `as: 'bar'`, beside `page`, `tab`, `panel`, and
  `section`. Its fields and actions live in it, the way a tool's options already live in the
  `PrefGroup` that `ToolOptionsBar` draws. There is no second document type.
- **The container picks the form, and an item may override it.** A leaf under a bar draws in its
  bar form, and a leaf under anything else draws in its row form. A leaf's `control` can still name
  any control from either set.
- **Actions are the host's registered ones.** The editor lists them, and dragging one in places a
  leaf that fires it by key. The layout stays plain data.

## Where things stand

| Piece | Today | Gap |
|---|---|---|
| Group forms | `PrefGroupAs` is `'page' \| 'tab' \| 'panel' \| 'section'` | No bar |
| Drawing a schema on one line | `ToolOptionsBar` flattens a `PrefGroup` to its leaves; nested groups draw nothing | It is a whole component, not a form a group can take inside a page |
| Bar-sized controls | CSS in `ToolOptionsBar.module.css` narrows whatever `PropertyControl` drew (`5ch` number box, `64px` range) | No component owns the bar form of a kind, so nothing else can draw one |
| Kind to control | Decided twice for a row: `renderBuiltin` in `Prefs/PrefsRow.tsx` and in `SelectionPanel/renderLeaf.tsx`. Both take a surface, and for `'bar'` hand the leaf to `renderBarLeaf` in `Bar/renderBarLeaf.tsx` | `renderBarLeaf` draws the row form behind a label, which is what `ToolOptionsBar` drew before it |
| Action leaves | `PrefAction` holds a `run` closure; `PrefActionButton` draws it | Code, so it cannot be dragged in, drafted, or exported |
| Registered actions | `ActionBar` draws every action in one `group` from the `ActionsRegistry` | Not placeable one at a time; `Action` has no pressed state |
| Editor preview | A `PrefsDialog` for a group root, a `SelectionPanel` for a section root | Nothing draws a bar, and drops are hit-tested as rows |

## Schema

In `@weasel-js/prefs`:

```ts
export type PrefGroupAs = 'page' | 'tab' | 'panel' | 'section' | 'bar';

export interface PrefAction extends PrefBase<'action', undefined> {
  /** The key of a registered action to fire: its id, or `id:variant`. */
  action?: string;
  /** What to call when no `action` is named. */
  run?: (ctx: PrefActionContext) => void | Promise<void>;
  label?: string;
  control?: 'button' | 'icon';
}
```

`action` is a plain string, so the package still depends on nothing. A leaf with both fires
`action`. The leaf's `name` and `icon` win over the registered action's own, which is how a layout
relabels one.

A bar's children, by what they are:

| Child of a bar | Drawn as |
|---|---|
| Leaf | Its bar form |
| Group `as: 'section'`, or unset | Its children in a run, a divider on each side, no heading |
| Group `as: 'bar'` | The same as a section |
| Group `as: 'panel'`, `'tab'`, or `'page'` | A button reading the group's name, which opens the group in a popover, drawn in its own form |

A bar's key is a segment of its leaves' paths, as any `PrefGroup`'s is, so moving a field into a
bar moves where its value is stored. Showing one setting in two places needs a leaf that points at
another, which this design leaves out.

## Bar forms

One new component, `BarField`, takes the same `PropertyControlProps` union `PropertyField` takes
and draws the cell a bar holds: the control at bar size, with an icon or a shortening label before
it where the control does not name itself. `PropertyField` stays the row form. The narrowing rules
in `ToolOptionsBar.module.css` move into it.

| Kind | Bar form by default | Other controls, on either surface |
|---|---|---|
| `number` | Narrow number box behind a `FitLabel` | `slider`: a short range |
| `string` | Narrow text box behind a `FitLabel` | `textarea`: a button that opens it in a popover |
| `boolean` | Toggle button, fused with paired neighbors into one `ToggleBar` | `checkbox`, `switch`: the control, then its label |
| `enum` | Bare `Select` | `toggle`: a segmented `ToggleBar`; `menu`: a `MenuButton` reading the current value; `radio` draws as `toggle` |
| `color`, `paint` | Swatch that opens the picker | |
| `field` | Bare `Select` | |
| `font-family`, `font-weight` | The selects they have now | |
| `object`, `list`, `map`, `union` | A button reading the leaf's name, which opens the row form in a popover | |
| `action` | Icon button with the label and shortcut in its tooltip | `button`: icon and label |
| `label` | Its text | |

`BarAction` is the action cell. `ActionBar`'s button moves into it, so the registry-driven icon
button has one definition.

`BarPopover` is the button-and-popover cell. Compound kinds use it, and so does a paged, tabbed, or
paneled group inside a bar.

## One place decides a leaf's bar form

`renderBarLeaf` is where the table above goes. Today it is handed the leaf and its row form, and
draws that. To draw a `BarField` it also needs the leaf's `prefFieldProps`, which each dispatcher
builds from its own values and has to pass in. A bar inside a `PrefsForm` page and a bar inside a
`SelectionPanel` then draw a kind the same way without either dispatcher copying the other.

An app's own renderer for a kind still draws that kind in a bar. `withBarLabel` sets the bar's
label before what it returns.

## `Bar`

A schema-driven strip: `schema`, `values`, `onChange`, `mixed`, and `renderers`, as
`ToolOptionsBar` takes them, plus `orientation`. It walks one bar group and draws the table under
"Schema". In a vertical bar a field has no room beside it, so every leaf but an action draws as a
`BarPopover`.

- `ToolOptionsBar` becomes its reserved-height row, its context label, a `Bar`, and its children
  slot.
- `ActionBar` becomes a `Bar` over action leaves made from the registry's actions in one group.
- `PrefsPane`'s `paneChildren`, `ObjectLeaf`, and `SelectionPanel` draw a group `as: 'bar'` with it.

Focus keeps plain tab order, for the reason `ToolOptionsBar` gives: a bar holding number boxes and
selects has to leave the arrow keys to them.

## Actions

In `@weasel-js/routing`, `ActionDispatch` gains a pressed state beside `enabled`:

```ts
active?: (deps?: ActionDeps) => boolean;
```

`BarAction` reads it into `aria-pressed`. Bold, snapping, and a visible grid are toggles, and a
toolbar that cannot show one as held down is missing the common case.

One hook, `useLeafAction(leaf, path)`, answers for an action leaf on any surface: what pressing it
does, and its label, icon, shortcut, and whether it is disabled, pending, or active. The row button,
the bar button, and a menu item all draw from it. With no `ActionsProvider` above, or a key the
registry does not hold, the button is disabled and its tooltip names the key.

Only actions `actionItems` lists can be placed, which leaves out any whose invoker is not
`'immediate'`.

## Editor

| Change | Where |
|---|---|
| `Bar` in the palette, with a new `formBar` glyph | `Palette.tsx`, `packages/ui/scripts/icons/` |
| `bar` among a group's "Drawn as" choices | `kindSchemas.ts` |
| An action leaf's attributes: `action` as a choice among the listed keys, and `control` | `kindSchemas.ts`, `attrRenderers.tsx` |
| Each kind's `control` choices widened to the table under "Bar forms" | `kindSchemas.ts` |
| An **Actions** list under the tree, beside the stored-values list: every action the host has, by group, with a filter box, each one draggable into the tree or the preview | New `ActionList.tsx`; `StructurePane.tsx` |
| A leaf firing a key the list does not hold is marked in the tree | `StructurePane.tsx` |
| A root drawn `as: 'bar'` previews as a `Bar` on a stage, with a switch for its orientation | `PreviewPane.tsx` |
| A drop into a bar is placed along the bar's axis, with the mark between two cells | `Prefs/dropTarget.ts`, `previewDrop.ts` |

The list comes from a new `actions` prop, a list of `{ key, label, group?, icon?, shortcut? }`.
Left out, the editor reads the `ActionsRegistry` above it. Dropping an entry makes
`{ kind: 'action', name: <its label>, description: '', default: undefined, action: <its key> }`.

That leaf holds no code, so it exports as written and survives a draft, which a `run` leaf does
not. The root's own `as` is set by selecting the root in the tree, which the attributes pane has to
allow.

## forge

- `ui/Bar/BarField`: a story per kind and control, and one matrix story setting every leaf kind's
  row form beside its bar form.
- `ui/Bar/BarAction`: enabled, disabled, pressed, pending, labeled, and an unknown key.
- `ui/Bar/Bar`: fields and actions together, divided runs, a popover group, both orientations.
- `ui/PrefSchemaEditor`: a toolbar story over a registry of sample actions.

A `*.browser.test.tsx` beside `BarField` checks what jsdom cannot: every bar form is the bar's
height and they share a baseline.

## Order

1. **Bar forms.** `BarField`, `BarPopover`, and their stories. `ToolOptionsBar`'s CSS overrides go.
2. **Actions by key.** `PrefAction.action`, `Action.active`, `useLeafAction`, `BarAction`.
   Independent of the bar forms.
3. **`Bar` and `as: 'bar'`.** The component, the schema value, and the surfaces that draw it;
   `ToolOptionsBar` and `ActionBar` rebuilt on it.
4. **Editor.** Palette, attributes, the Actions list, the bar preview, and drops along a bar.

## Left out

- **A leaf that points at another**, for one setting shown in a dialog and in a bar.
- **Overflow.** A bar too long for its room scrolls, as `ToolOptionsBar` does now.
- **Orientation in the schema.** The host says which way a bar runs.
