# Handoff — node paint as objects

Two branches in flight, both off `main` at `343c9913`. The design lives in
`docs/proposals/2026-08-26-node-stroke-union.md`; this file is only the state
that doc can't carry.

## Branches

**`node-stroke-union`** — worktree `.claude/worktrees/node-stroke-union`, at
`3cd1ee8a`. Green: `tsc`, `eslint`, 7201 tests. Not pushed. Five commits:

1. `data.stroke` takes a whole `Stroke`, `NodeInk` reports per-side reach.
2. A labkit example building controls from weasel schemas.
3. The union edited as a union in the property panels.
4. SVG import keeps dash / cap / join / gradient paint.
5. `ToolPrefObject` — one leaf holds an object, fields as children.

**`paint-object-collapse`** — worktree `.claude/worktrees/paint-object-collapse`,
branched from `3cd1ee8a`, being written by a background agent. Progress:
`.paint-collapse-progress.jsonl` in that worktree, one JSON line per phase.
It removes the scalar forms outright: `data.fill` always a `FillStyle`,
`data.stroke` always a `Stroke`, `data.strokeWidth` and `data.color` gone,
`solid()` / `strokeOf()` as the authoring helpers. It will conflict with any
edit to `defaultNodeProperties.ts`, the setter actions, the painters, the SVG
mappings or draw's models until it lands.

## Next, in order

1. **Object leaves take presentational groups.** `ToolPrefObject.children`
   accepts a group as well as a leaf, group keys contributing nothing to the
   path — the same rule the top level already has. Text style needs it or it
   flattens to ten undifferentiated rows. Started; touches `tools/prefs.ts`
   and the two panel renderers only, which is why it can run beside the sweep.
2. **`data.style` becomes an object leaf**, Character and Paragraph as groups
   inside it. Wait for the sweep.
3. **Paint moves out of `TextStyle`.** A text node is painted by `data.fill` /
   `data.stroke` like every other node; `StyledRun.fill` / `.stroke` stay as
   per-range overrides; `withLeafStroke` is deleted rather than gaining a fill
   twin. Breaks documents holding `style.fill` — accepted, wants a changeset
   line since it fails as a wrong colour rather than an error.

## Decisions made in conversation, not visible in the code

- **Breaking compatibility beats adding a compatibility path.** Standing
  default, stated 2026-08-26. Don't offer a fallback-for-old-documents option;
  propose the break and name what it costs.
- **Sub-section layout** for the stroke fields (option D of four mocked up) —
  its own titled block, not a popover and not six flat rows.
- **Dash has no control.** A `number[]` has no leaf kind; it survives import,
  render and export untouched. Named presets were rejected as a stand-in for
  the kit (the labkit example still uses them, and says so).
- **Cap/join/dash editing waited on arc 3** because a panel that can mint a
  rich stroke in WeaselDraw before its exporter understands one produces files
  that disagree with the canvas. Arc 3 removed that; the rows exist now.

## Traps

- **The shell cwd resets to the main checkout.** A relative-path command then
  edits `/Users/mike/src/weasel` instead of the worktree, and a test run there
  measures the wrong tree — it happened, and the "green" it printed was
  meaningless. Use worktree-absolute paths for everything.
- `data.strokeWidth` is still written by nothing and read by nothing after
  commit 5. The sweep deletes the field; until then it lingers in old data.
