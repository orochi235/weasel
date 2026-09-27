---
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

**Breaking.** A bare `<SceneCanvas>` now only renders. It keeps a selection that
no input sets and runs the gesture dispatcher for bindings you add, but it no
longer picks, moves, transforms or edits, draws no selection chrome, pans and
zooms nothing, and binds no keys. `features={['draw']}` restores everything it
used to do, and adds the hand tool (H, or hold Space), which it used to register
only when `viewport` was passed.

`features` takes presets that compose in any combination: `view` (wheel pan and
zoom, pinch, zoom keys, the hand tool — passing `viewport` implies it), `pick`
(the select tool and the selection outline), `move` (drag to move, Alt-drag to
clone), `transform` (resize and rotation handles), `edit` (undo/redo, delete,
duplicate, group, nudge, select-all, Escape, clipboard, fill and stroke, with
their keys), `arrange` (align, distribute, reorder, flip), `paths` (pathfinder
and anchor editing), `ingest` (dropped and pasted content), and `draw` for all
of them. `FEATURE_ACTION_IDS` lists which kit action each one registers. A tool
brings the actions it binds, so `defaultTools={['rect']}` registers `insert`
under any preset; `defaultTools` now defaults to none.

`toolBundle` and `BUNDLE_TOOLS` are removed. `toolBundle="minimal"` is
`features={['draw']}`; `"standard"` adds `defaultTools={['rect', 'ellipse',
'line']}`, and `"exhaustive"` adds `defaultTools={BUILTIN_TOOL_IDS}`.

The select tool only chooses now: pick, marquee, clear. Moving, cloning,
resizing and rotating the selection are always-live bindings of their own,
`selectionMoveContribution` and `selectionTransformContribution`, so they work
under any tool that leaves the drag unclaimed. `useSelectTool` no longer takes
`move` or `reparentOnDrop`; pass them to `selectionMoveContribution`, or give
`<SceneCanvas>` a `selectTool.move`. A host mounting `useSelectTool` on its own
dispatcher has to add those entries itself to keep drag-to-move.

`rotate` and `clone` no longer carry a bare-drag default binding, which made
any drag no tool claimed rotate a non-empty selection.

A canvas can run with no active tool: `useTools` takes `active` as optional or
`null`, and `ToolsApi.active` and `ActiveToolContext.active` can be `null`.
`ActiveToolContextProvider` starts empty rather than at `'select'`, and the
first `useTools` call seeds it unless the provider was given `initialActive`.
