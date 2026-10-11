# Selecting several nodes in `PrefSchemaEditor`

**Unbuilt.** Nothing here is implemented. The steps are in
`../plans/2026-10-10-prefs-editor-multiselect.md`. Delete both when the work merges.

For whoever builds this. It says what selecting several nodes in the schema editor has to mean in
each pane, what is already in place, and what has to be written.

## What exists

Read from the tree at `ce3c1c8bc`; nothing below was run.

| Piece | State today |
|---|---|
| `Tree` | `selectionMode="multiple"` works: Cmd/Ctrl toggles a row, Shift ranges from the anchor, and a drag or Alt+Up/Down carries every selected row (`draggedIdsFor`). The editor passes `"single"`. |
| `moveNodes`, `copyNodes` | Take a list of paths, drop any path beneath another in the list, and return each node's new path. |
| `canDrop` in `StructurePane` | Written over a set of ids. |
| `DropOutside`, `previewDrop`, `previewTarget`, `heldDrop` | Signatures take `nodes[]` and `paths[]`. No caller has ever passed more than one. |
| History's selection hook | Already reads and writes `string[]`; the editor wraps its one path in an array. |
| `removeNode` | One path. |
| Editor state | `selected: string \| null`, where `null` is the root. Every pane takes that one path. |
| `AttributesPane` | Edits the node at one path. |
| `PrefsForm` | `selected?: string` marks one row, scrolls to it, and opens the rail page or tab that holds it. `onSelect(path)` fires on a press or a focus. It has an `auto` set of paths and nothing for values that disagree. |
| `usePreviewDrag` | Picks up the one node under the pointer. |

## The selection

State becomes an ordered list of paths with no duplicates. Empty means the root, as `null` does now.

**The lead** is the path selected most recently: the last in the list. Wherever one node has to
stand for the selection, it is the lead. That covers which tree row is scrolled into view, which
page the preview opens, and where an add lands.

Rules:

- The General row stands for the root, so it never joins others. A change that would hold it beside
  real paths drops it.
- A node and one of its descendants may both be selected. Move, copy, and remove act on the
  outermost ones, as `moveNodes` already does; attribute edits act on each.
- After any change to the schema, paths that no longer name a node leave the selection.

The list and these rules go in a hook of their own, `useEditorSelection.ts`, taking the state out
of `PrefSchemaEditor.tsx` (320 lines). It hands out `paths`, `lead`, `set`, `toggle`, `rebase`,
and `reveal`. `Tree` reports a `Set`; the hook works out the lead as the id the new set has and the
old one lacks, keeping the old lead when nothing was added and it is still there.

## What each action does with several nodes

| Action | With several selected |
|---|---|
| Drag, Alt-drag, Alt+Up/Down in the tree | Already carry every selected row. Afterward all the moved or copied nodes are selected; today only the first is. |
| Remove button, Delete, Backspace | Remove the outermost selected nodes in one undo step, then select the first one's parent. Disabled when any selected node is fixed (a list's item, a union's variant), matching what `canDrop` refuses. Needs `removeNodes(root, paths)`. |
| Add pref, Add group, a palette drop without a tree target | Land relative to the lead, by the rule `addTarget` has now. |
| Undo, redo | Restore the whole list. |
| Key rename (`rekey`) | Only reachable with one node selected. |
| Discard draft | Clears the list. |

## Attributes over several nodes

This is the largest part. `AttributesPane` takes `paths` in place of `path` and has one code path:
a single node is a selection of one.

**Which rows show.** `attributeSchema(node, custom)` is taken for each node, and an attribute shows
when every node has it with a deep-equal definition. Two leaves of one kind keep their kind's own
panel; a number and an integer keep `min` and `max`; a leaf and a group keep `name`,
`description`, and whatever else they share. The kind panel's heading is the kind when all agree,
and "Common" otherwise; kinds with nothing of their own in common show no panel.

| Row | With several selected |
|---|---|
| Header | "3 selected" in place of nothing. |
| Key | Hidden. |
| Name | Shown. The key does not follow the name. |
| Kind | Shown when every node is a leaf and none is a union's variant. Choosing one runs `changeKind` on each, and the notice lists what was dropped across all of them. |
| A scalar attribute | Its value where the nodes agree; the control's mixed state where they do not. An edit writes every node. |
| A compound attribute (list, map, object, union) that disagrees | Not editable. Listed with the read-only rows as "mixed". |
| Auto value | Auto when every node has none set, set when all do, mixed otherwise. |
| Read-only rows | Shown where every node agrees. |

**Aggregating.** A new module, `attrAggregate.ts`, returns the shared schema, the values, and the
set of mixed paths. Agreement is deep equality: `SelectionPanel`'s `aggregateValue` uses
`Object.is`, which would call two equal option lists mixed. The disagreement sentinel is core's
`MIXED`, not a second one.

**`PrefsForm` needs a way to draw a value that disagrees.** Add `mixed?: ReadonlySet<string>`
beside `auto`, by the same paths. A built-in control gets `mixed: true` through `prefFieldProps`,
which already takes it; `PrefRenderContext` gains `mixed` so a custom renderer can draw it. The
editor's own renderers in `attrRenderers.tsx` and the Name, Key, and Kind renderers each need a
mixed state.

**Writing.** One edit maps `setAttribute` over the paths and commits once. The coalesce key is
`attr:` followed by the sorted paths, so typing into a field across the selection is one undo step.

## The live preview

`PrefsForm` is the published surface that changes:

- `selected` becomes `readonly string[]`. Every path in it is marked `data-selected`; the last is
  the one scrolled to and the one whose rail page or tab opens. This replaces the string form
  outright. `selected` is unreleased: `.changeset/prefs-form-selection.md` is still pending.
- `onSelect(path, how)` gains `how: { toggle: boolean }`, true when Cmd or Ctrl was held on the
  press. Shift does nothing in the form: a range across pages and tabs has no clear meaning.
- A press on a row already in a selection of several does not report on the way down, so a drag
  can carry them all. It reports on the click, collapsing to that row, the way `DetailList` does.
- A focus never toggles, and a focus on a row already selected reports nothing. `useSelectedRow`
  fires on both the press and the focus that follows it, so without this a Cmd-press toggles twice.

`usePreviewDrag` carries the whole selection when the pressed node is in it, and that node alone
otherwise. The ghost is the pressed node as now, with a count on it.

**Check before trusting.** `previewDrop`, `previewTarget`, `heldDrop`, and `drawsNode` take lists
but have only been driven with one node. Selections that mix a top-level page with leaves, or that
span two parents, need their landing rules read and tested: what the form draws at the drop, and
whether `fitsUnder` and `withinDepth` refuse the whole drag when one node does not fit.

A section schema's preview is a `SelectionPanel` and ignores the selection today (`docs/TODO.md`,
"properties-panel preview ignores the selection"). That stays as it is.

## Order of work

Each step leaves the editor working.

1. **Selection list, tree, and actions.** The hook, `selectionMode="multiple"`, `removeNodes`,
   select-all-moved, and the lead driving add and scroll. Until step 2 the attributes pane shows
   the header and no form when several are selected; the preview marks the lead only.
2. **Attributes.** `PrefsForm`'s `mixed`, `attrAggregate.ts`, the pane on `paths`, and mixed states
   in the editor's renderers.
3. **Preview.** `selected` as a list, `onSelect`'s `how`, press-then-click collapse, and
   `usePreviewDrag` carrying several.

Step 2 is the bulk; step 1 is mostly wiring what exists.

## Tests

- Unit: `removeNodes`; `attrAggregate` (agreeing, mixed, compound, differing kinds, a leaf beside a
  group); the selection hook's rules.
- jsdom, in new files rather than the 654-line `PrefSchemaEditor.test.tsx`: Cmd-click and
  Shift-click in the tree, remove of several, an attribute edit writing every node as one undo
  step, and undo restoring the list.
- `*.browser.test.tsx`: Cmd-click in the preview, and a drag of several from the preview and from
  the tree onto it. jsdom's pointer capture does nothing, so a drag test there cannot fail.
- Stories: `PrefsForm` with several selected and with mixed values; the editor with several selected.

One `patch` changeset, saying in prose that `PrefsForm`'s `selected` and `onSelect` changed shape.

## Not included

- Dragging several nodes out of the Unplaced tree or the palette. `onPaletteDrop` takes one node;
  that is its own change.
- Select-all in the tree. `Tree` has no Mod+A; it belongs to `Tree`, not the editor.
