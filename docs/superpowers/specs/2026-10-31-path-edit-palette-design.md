# Path edit gets its own palette

For whoever builds or later changes how tools are scoped to modes, and how WeaselDraw's left palette is laid out.
Answers: what the palette shows in each mode, and what the kit gains so that it can.

Status: designed and approved by the maintainer (2026-10-31); built on branch `path-edit-palette` (2026-10-31).

## Decisions (2026-10-31)

- Path edit's palette holds its tools and the overlay toggles. One-shot anchor commands (Join, Average,
  Cut at Crossings, segment type) stay in the Path strip.
- The reshape column (Girth, Trim/Extend, Smudge brush, Distort/Envelope/Puppet) folds into the main
  palette as groups after the core tools. Draw has one left column in every mode.
- One palette, filtered by mode, rather than a draw-side component swap or a per-mode tool-set map: the
  mode's capabilities already say which tools it allows.

## Kit

**Path-edit tools are tools.** Simplify brush and Lengthen each get a `ToolDef` binding a drag to its
existing action, carrying the `edits-anchors` capability, which only path edit allows. Anchor editing is a
tool too, `anchors`: what a drag in path edit does with no other tool on. `@weasel-js/path-tools` ships
`PATH_EDIT_TOOLS` and a hook building them, beside `RESHAPE_TOOLS`; `anchors` belongs to core, since core
owns anchor editing. The `pathEditTool.*` toggle actions and the `editAnchors` dep's `tool` / `setTool`
retire: a drag's meaning is the active tool's binding, one pathway.

**A mode names a default tool.** `ModeDefinition.defaultTool?: string`. Entering the mode activates it;
leaving restores the tool active at entry. Path edit names `anchors`. Escape with a path-edit tool on
returns to `anchors`; with `anchors` on, Escape leaves path edit.

**`ToolPalette` takes `ineligible: 'dim' | 'hide'`**, default `dim`. Hand and Measure carry only implicit
capabilities, so they show in both modes.

**Overlay toggles are actions.** `pathEdit.show.direction`, `.comb`, `.balance`, and `.corners`, group
`pathOverlays`, in `@weasel-js/path-tools`. Each flips its chrome rule (`path-edit.<x>`) between `always`
and `never`; the presets' defaults stand (comb, balance, direction hidden; corners shown).

## WeaselDraw

- One left palette, `ineligible="hide"`, core groups then the reshape groups with their stacks.
  `FIXED_CHROME.pathTools` is removed; a saved hidden flag for it is dropped by the prefs migration.
- Under the palette, while path edit is on, a vertical bar of the `pathOverlays` group.
- `usePathDirection` becomes `usePathOverlays`: one View pref per overlay, `view.pathDirection` kept.
- The Path strip loses the Simplify brush and Lengthen toggles with their actions.

## Tests

Kit: a mode's default tool on entry and the prior tool restored on exit; a hidden ineligible tool not
rendered; each path-edit tool running from its binding. Path-tools: Simplify brush and Lengthen tests moved
from toggles to bindings. Draw: the palette's contents in each mode, each overlay toggle flipping its chrome
rule, the pref migration.
