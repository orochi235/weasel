# A toolbar is a group drawn as a bar

**Partly built.** The bar forms (`BarField`, `BarPopover`, `BarAction`), action leaves that fire
by key (`useLeafAction`), `Bar` with the `as: 'bar'` group form, and the schema editor's bar and
Actions list are in. What is unbuilt is under "Not yet drawn as a bar" and the table under
"Editor". For whoever builds it.

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
bar moves where its value is stored. One setting shown in two places is an `alias` leaf, which a bar in a form draws as the leaf it
points at.

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

The palette makes a bar, a group's "Drawn as" offers one, and an action leaf's attributes hold the
key it fires and its `control`. A root drawn `as: 'bar'` previews as the toolbar itself, with a
switch that runs it down its side, and the tree lists its prefs directly, where any other group
root lists pages. A bar inside a page previews in the form. With nothing selected the attributes
pane edits the root, so its "Drawn as" turns any group root into a toolbar.

The **Actions** list sits under the Unplaced tree, filtered by the structure's own filter box. It
holds the `actions` prop, or else what the `ActionsRegistry` above the editor can fire from a
button, which leaves out any action whose invoker is not `'immediate'`. An entry dragged into the
tree or the preview lands as `{ kind: 'action', name, description: '', default: undefined, action }`,
which holds no code, so it exports as written and survives a draft. A pref firing a key the list
does not hold is marked "no action" in the tree.

Still to build:

| Change | Where |
|---|---|
| A drop into a bar is placed along the bar's axis, with the mark between two cells. A drop onto a bar in the preview is hit-tested as rows today | `Prefs/dropTarget.ts`, `previewDrop.ts` |
| A drop onto the bar preview of a bar root. Nothing takes one today; the tree does | `PreviewPane.tsx` |
| A click in the bar preview of a bar root selects that pref in the tree, as a click in the form preview does | `PreviewPane.tsx`, `Bar` |

## Left out

- **Overflow.** A bar too long for its room scrolls, as `ToolOptionsBar` does now.
- **Orientation in the schema.** The host says which way a bar runs.
