# A toolbar is a group drawn as a bar

**Built, but for the editor.** Written 2026-10-10 on branch `toolbar-editor`, which holds the bar
forms (`BarField`, `BarPopover`, `BarAction`), action leaves that fire by key (`useLeafAction`),
and `Bar` with the `as: 'bar'` group form. What is unbuilt is under "Editor" and "Not yet drawn as
a bar". For whoever builds it.

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

A bar's children, by what they are:

| Child of a bar | Drawn as |
|---|---|
| Leaf | Its bar form |
| Group `as: 'section'`, `'bar'`, or `'fragment'`, or unset | Its children in a run, a divider on each side, no heading |
| Group `as: 'panel'`, `'tab'`, or `'page'` | A button reading the group's name, which opens the group in a popover |

A bar's key is a segment of its leaves' paths, as any `PrefGroup`'s is, so moving a field into a
bar moves where its value is stored. Showing one setting in two places needs a leaf that points at
another, which this design leaves out.

`Bar` draws a schema, and `ToolOptionsBar` is built on it. `PrefsPane`, a form's `ObjectLeaf`, and
`SelectionPanel` draw a group `as: 'bar'` through `BarLayout` with their own cells.

## Not yet drawn as a bar

A group `as: 'bar'` falls back to a headed block of rows in these two places:

- **A section inside an object leaf in `SelectionPanel`.** Its `ObjectLeaf` builds each field's
  context inline in `rowsOf`, in a 690-line `renderLeaf.tsx`. It wants splitting into its own file
  first, with the field context as a function a bar section can call.
- **labkit's `ControlPanel`**, which reads a group's `as` on its own.

A group opened from a `Bar` draws as labeled rows under headings, whatever its `as`. Opened from a
bar in a `PrefsForm`, it draws in its own form, since the form's own walker draws it.

`ActionBar` is not built on `Bar`. It draws through `BarActionButton`, so the button has one
definition, but its `icons` prop overrides an entry's icon with a `ReactNode`, which a leaf, being
data, cannot carry. Building it on `Bar` needs that prop to become icon names, or `Bar` to take
icon overrides by path.

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

`ui/PrefSchemaEditor`: a toolbar story over a registry of sample actions.

## Left out

- **A leaf that points at another**, for one setting shown in a dialog and in a bar.
- **Overflow.** A bar too long for its room scrolls, as `ToolOptionsBar` does now.
- **Orientation in the schema.** The host says which way a bar runs.
