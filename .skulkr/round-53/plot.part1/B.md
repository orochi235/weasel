# Audit round 53 — plot.part1 findings

## Renaming a branch command leaves its checkouts and merges naming the old name, though renaming the main branch follows them
- where: packages/plot/src/gitgraph/structure.ts:74 (setGitCommandField), reached from packages/plot/src/gitgraph/schema.ts:141 (column 'target')
- scenario: commands `branch dev`, `commit`, `checkout main`, `merge dev`; set the first command's `name` to `feature` through `setGitCommandField(d, 0, 'name', 'feature')` (the schema's "Branch or commit" cell). The `checkout`/`merge` still say `dev`, so the replay stops at `merge dev` with "no such branch" and every command after it vanishes from the drawing. `setGitMainBranch` (same file, line 92) answers the same question the other way: it renames every checkout and merge of the old name. A rename of a non-main branch should follow its references the same way.
- evidence: read
- severity: medium

## Changing a commit's id leaves cherry-picks of it naming the old id, where gantt renames follow every dependency
- where: packages/plot/src/gitgraph/structure.ts:74 (setGitCommandField, field 'id' on a commit or merge)
- scenario: `commit id: "A"`, `branch dev`, `cherry-pick id: "A"`; set the commit's id to `B` (schema "Id" column). The cherry-pick still names `A`, the replay errors "no such commit" and drops the rest of the graph. `setGanttTaskId` (gantt/structure.ts:109) renames every `after`/`until` naming the old id for the same kind of edit, so the two chart kinds answer "does an id rename follow its references" differently. The same applies to a cherry-pick's `parent`.
- evidence: read
- severity: medium

## setGitCommandKind's filled-in defaults for cherry-pick and merge name a target the command cannot use
- where: packages/plot/src/gitgraph/structure.ts:57-64 (setGitCommandKind)
- scenario: the "last commit id" is taken over every command in the graph, including the command being converted and those after it. Turn the only commit with an id (`commit id: "X"`) into a cherry-pick: its own id is dropped (kept only between cherry-picks), and `needs.id` is `"X"`, the commit that just stopped existing, so the replay fails "no such commit". It also picks ids of commits that come later, or ones on the current branch ("already on"). Merge has the same problem: `branches[branches.length - 1]` can be a branch created after `at`, or the branch that is checked out at `at`, which gives "cannot be merged into itself". The defaults should come from the history replayed up to `at`.
- evidence: read
- severity: low

## moveGanttTaskToSection within one section reads `at` as a move index, not "before task at", and throws when `at` is the length
- where: packages/plot/src/gantt/structure.ts:91 (moveGanttTaskToSection)
- scenario: the doc says the task goes "before its task `at` (absent, last)", which is an insert index, and the cross-section path uses it that way (`insertAt`). With `from === to` it calls `reorderGanttTask(data, from, task, at)`, which uses `moveAt`'s index counted after the task is removed. Tasks `[A, B, C]`, `moveGanttTaskToSection(d, 0, 0, 0, 2)` should give `[B, A, C]` (before C) but gives `[B, C, A]`. `at = 3` (the length, i.e. append) throws "cannot move to 3", while the same `at` works when the section differs.
- evidence: read
- severity: low

## A calendar-month duration from the end of a month overflows into the month after next instead of clamping
- where: packages/plot/src/gantt/schedule.ts:224 (addMonths)
- scenario: a task starting `2024-01-31` with duration `1M`. `setUTCMonth(month + 1)` on Jan 31 gives Mar 2, 2024, so the bar runs a month and two days. The format is Day.js's, and Day.js's `add(1, 'M')` (what Mermaid schedules with) clamps to Feb 29. Every month-end start of an `M` or `y` duration comes out 1 to 3 days long (`y` from Feb 29 too: 2024-02-29 + 1y gives 2025-03-01).
- evidence: read
- severity: low

## ganttDurationBetween counts excluded days on spans past WALK_LIMIT where addGanttDuration does not, so a long task shrinks on edit
- where: packages/plot/src/gantt/schedule.ts:252 (ganttDurationBetween) vs :246 (endAfter)
- scenario: a task of `150000d` with `excludes: ['weekends']`. `endAfter` skips the excluded-day walk past WALK_LIMIT, so its end is start + 150000 days. Dragging its end handle (or any `setGanttEndDay` near that end) calls `ganttDurationBetween`, which caps `steps` at 100000 and counts only weekdays among them: about 71429, so the task is cut to under half its length. Its own doc says it counts "as addGanttDuration counts them". Past the limit it should count calendar days, as `endAfter` does.
- evidence: read
- severity: low

## A todayMarker stroke written as rgb()/hsl() is cut at its first comma
- where: packages/plot/src/gantt/compile.ts:50 (todayStroke)
- scenario: `todayMarker: 'stroke:rgb(255,0,0),stroke-width:3'`. The color capture `[^;,]+` stops at the first comma and yields `rgb(255`, an invalid color, so the today line gets an unparseable paint. The separator split should skip commas inside parentheses.
- evidence: read
- severity: low

## Undo in PlotView after a resize or theme change restores marks compiled for the old size and theme
- where: packages/plot/src/PlotView.tsx:59-77 (Inner's redraw effect)
- scenario: drag a bar (one tracked "Edit value" entry, with the marks compiled at 400×300), then the host changes `width` to 800. The effect redraws through `scene.untracked`, so the history still holds the earlier entry's mark snapshots. Cmd+Z then reverts the root data and puts back the pre-edit marks laid out for 400×300 inside an 800-wide root. It does the same with the theme: the root's `{ data, theme }` goes back to the old theme even though the prop has changed. The effect does not rerun because its deps have not changed, so the view stays mismatched until the next prop change. Inferred from how ops-based undo restores removed nodes' snapshots; not run.
- evidence: inferred
- severity: medium

## Files read
packages/plot/src/PlotView.tsx
packages/plot/src/axes.ts
packages/plot/src/chartTitle.ts
packages/plot/src/editing/createPlotEditingContribution.ts
packages/plot/src/editing/dragAction.ts
packages/plot/src/editing/editors.ts
packages/plot/src/editing/handleLayer.ts
packages/plot/src/editing/lists.ts
packages/plot/src/editing/schemaKit.ts
packages/plot/src/editing/schemaTypes.ts
packages/plot/src/editing/schemas.ts
packages/plot/src/editing/textEdit.ts
packages/plot/src/gantt/compile.ts
packages/plot/src/gantt/dates.ts
packages/plot/src/gantt/edit.ts
packages/plot/src/gantt/editor.ts
packages/plot/src/gantt/schedule.ts
packages/plot/src/gantt/schema.ts
packages/plot/src/gantt/structure.ts
packages/plot/src/gantt/text.ts
packages/plot/src/gantt/types.ts
packages/plot/src/gitgraph/compile.ts
packages/plot/src/gitgraph/edit.ts
packages/plot/src/gitgraph/editor.ts
packages/plot/src/gitgraph/replay.ts
packages/plot/src/gitgraph/schema.ts
packages/plot/src/gitgraph/structure.ts
packages/plot/src/gitgraph/types.ts
packages/plot/src/index.ts
packages/plot/src/journey/compile.ts
packages/plot/src/journey/edit.ts
packages/plot/src/journey/editor.ts
packages/plot/src/journey/schema.ts
packages/plot/src/journey/structure.ts
packages/plot/src/journey/types.ts
packages/plot/src/marks/boxes.ts
packages/plot/src/marks/clip.ts
packages/plot/src/marks/paths.ts
packages/plot/src/marks/text.ts
packages/plot/src/marks/types.ts
packages/plot/src/measure.ts
packages/plot/src/packet/compile.ts
packages/plot/src/packet/edit.ts
packages/plot/src/packet/editor.ts

<!-- done: 8 findings, files read: 44 -->
