# A toolbar is a group drawn as a bar

**Partly built.** Written 2026-10-10 on branch `toolbar-editor`, which holds the bar forms
(`BarField`, `BarPopover`, `BarAction`, `renderBarLeaf`) and action leaves that fire by key
(`useLeafAction`); everything else below is unbuilt. For whoever builds it. It says what has to change for `PrefSchemaEditor` to lay
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
| Bar-sized controls | `BarField` draws a field's bar form, `BarAction` an action's, and `BarPopover` what one line cannot hold | None |
| Kind to control | Both `renderBuiltin`s take a surface, and for `'bar'` hand the leaf and its field props to `renderBarLeaf` in `Bar/renderBarLeaf.tsx` | Nothing but `ToolOptionsBar` asks for `'bar'` yet |
| Action leaves | `PrefAction.action` names a registered action by key, and `useLeafAction` fires it | The editor cannot place one |
| Registered actions | `ActionBar` draws every action in one `group` from the `ActionsRegistry`, pressed while `active` | Not placeable one at a time |
| Editor preview | A `PrefsDialog` for a group root, a `SelectionPanel` for a section root | Nothing draws a bar, and drops are hit-tested as rows |

## Schema

In `@weasel-js/prefs`:

```ts
export type PrefGroupAs = 'page' | 'tab' | 'panel' | 'section' | 'bar';
```

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

## Editor

| Change | Where |
|---|---|
| `Bar` in the palette, with a new `formBar` glyph | `Palette.tsx`, `packages/ui/scripts/icons/` |
| `bar` among a group's "Drawn as" choices | `kindSchemas.ts` |
| An action leaf's attributes: `action` as a choice among the listed keys, and `control` | `kindSchemas.ts`, `attrRenderers.tsx` |
| An **Actions** list under the tree, beside the stored-values list: every action the host has, by group, with a filter box, each one draggable into the tree or the preview | New `ActionList.tsx`; `StructurePane.tsx` |
| A leaf firing a key the list does not hold is marked in the tree | `StructurePane.tsx` |
| A root drawn `as: 'bar'` previews as a `Bar` on a stage, with a switch for its orientation | `PreviewPane.tsx` |
| A drop into a bar is placed along the bar's axis, with the mark between two cells | `Prefs/dropTarget.ts`, `previewDrop.ts` |

Only actions `actionItems` lists can be placed, which leaves out any whose invoker is not
`'immediate'`. The list comes from a new `actions` prop, a list of `{ key, label, group?, icon?, shortcut? }`.
Left out, the editor reads the `ActionsRegistry` above it. Dropping an entry makes
`{ kind: 'action', name: <its label>, description: '', default: undefined, action: <its key> }`.

That leaf holds no code, so it exports as written and survives a draft, which a `run` leaf does
not. The root's own `as` is set by selecting the root in the tree, which the attributes pane has to
allow.

## forge

- `ui/Bar/Bar`: fields and actions together, divided runs, a popover group, both orientations.
- `ui/PrefSchemaEditor`: a toolbar story over a registry of sample actions.

## Order

1. **`Bar` and `as: 'bar'`.** The component, the schema value, and the surfaces that draw it;
   `ToolOptionsBar` and `ActionBar` rebuilt on it.
2. **Editor.** Palette, attributes, the Actions list, the bar preview, and drops along a bar.

## Left out

- **A leaf that points at another**, for one setting shown in a dialog and in a bar.
- **Overflow.** A bar too long for its room scrolls, as `ToolOptionsBar` does now.
- **Orientation in the schema.** The host says which way a bar runs.
