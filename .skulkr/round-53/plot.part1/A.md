# Audit round 53 — plot.part1 findings

## A month or year duration starting past the target month's last day overflows into the next month, where Mermaid clamps
- where: packages/plot/src/gantt/schedule.ts:55 (addMonths)
- scenario: a task `start 2024-01-31, end 1M` (or `2024-03-31` + `1M`, or `2024-02-29` + `1y`). `d.setUTCMonth(d.getUTCMonth() + 1)` on Jan 31 lands on "Feb 31", which `Date` rolls over to 2024-03-02, so the bar ends two days into March. Mermaid adds durations with Day.js `add(n, 'M')`, which clamps to the target month's last day (2024-02-29). The same goes for `1y` from Feb 29, which ends 2025-03-01 rather than 2025-02-28. Only the far-from-epoch fallback to 30 days a month is ruled (docs/unruled.md, 2026-11-10). The edit side (`ganttDurationBetween`, schedule.ts:83) counts months as 30.44 days, so on these dates the drawn end and the amount a drag reads back also disagree.
- evidence: read
- severity: medium

## Renaming a branch in the commands table leaves later checkouts and merges on the old name, so the graph stops there
- where: packages/plot/src/gitgraph/structure.ts:73 (setGitCommandField), reached from packages/plot/src/gitgraph/schema.ts:17 (column 'target')
- scenario: commands `branch dev`, `commit`, `checkout main`, `merge dev`. Setting the first row's "Branch or commit" cell to `feature` rewrites only that command's `name`. `merge dev` then fails in replay (`cannot merge "dev": there is no such branch`), and everything after it is dropped from the drawing. A name another branch already holds is accepted too, and replay stops at it (`a branch "x" already exists`). `setGitMainBranch` (structure.ts:91) handles the same rename the other way: it renames every checkout and merge of the main branch and refuses a name already taken. Gantt's `setGanttTaskId` also carries dependencies along with the id. A branch rename is the one rename here that leaves its references behind.
- evidence: read
- severity: medium

## Changing a commit's id leaves cherry-picks naming the old id, so replay stops at them
- where: packages/plot/src/gitgraph/structure.ts:73 (setGitCommandField, field 'id' on a commit or merge)
- scenario: `commit id:"A"` on dev, then later `cherry-pick id:"A"` on main (or a cherry-pick whose `parent` names a merge's id). Editing the commit's Id cell to `B` rewrites only that command. The cherry-pick still names `A`, replay fails with `cannot cherry-pick "A": there is no such commit`, and the rest of the graph is dropped. This is the same kind of defect as the branch rename above: a cherry-pick's `id` and `parent` are references that should follow the rename.
- evidence: read
- severity: low

## Turning a command into a merge fills in the last branch created, often the branch the command runs on
- where: packages/plot/src/gitgraph/structure.ts:61 (setGitCommandKind, `kind === 'merge'`)
- scenario: commands `branch dev`, `commit`, `commit`; set the third row's Command cell to `merge`. The fill `branches[branches.length - 1]` is `dev`, which is the checked-out branch at that point, so replay fails with `"dev" cannot be merged into itself` and the graph stops there. When the graph has only its main branch, the fill is the main branch, which fails the same way on main. The fill never looks at which branch is checked out at `at`.
- evidence: read
- severity: low

## moveGanttTaskToSection within one section counts `at` after removal, against its own "before its task `at`"
- where: packages/plot/src/gantt/structure.ts:86 (moveGanttTaskToSection, `from === to` branch)
- scenario: a section's tasks are `[A, B, C]`. `moveGanttTaskToSection(data, 0, 0, 0, 2)`, read as "before its task 2", should give `[B, A, C]`. It calls `reorderGanttTask(data, 0, 0, 2)`, whose `to` is counted after A is taken out, so the result is `[B, C, A]`. Across sections `at` is an index into the target section as it stands, as documented. Within one section, any `at` past `task` lands one place later than asked.
- evidence: read
- severity: low

## A drag that lands past year 9999 (or before year 0) writes a date the chart's own format cannot read, so the task jumps to the chart's first date
- where: packages/plot/src/gantt/dates.ts:86 (formatGanttDate, `YYYY`); packages/plot/src/gantt/edit.ts:27 (setGanttStartDay), and the `date` branch of setGanttEndDay
- scenario: take a chart whose domain reaches past 9999 (a task of `9000y`, which `addMonths` and the domain allow) and drag another task's start out there. `pad(d.getUTCFullYear(), 4)` writes `12000-01-01`, but `parseGanttDate` wants exactly `\d{4}` for `YYYY`. The start no longer reads, and `scheduleGantt` puts the task at `first`. Negative years are written as `00-5-…`, which reads neither. The schema's Start and End cells refuse a date that does not read (`reads` in gantt/schema.ts), so a drag is the only path that writes one.
- evidence: read
- severity: low

## A long chain of forward `after` dependencies is scheduled by unbounded recursion and overflows the stack
- where: packages/plot/src/gantt/schedule.ts:109 (scheduleGantt: startOf/endOf through memo)
- scenario: a few thousand tasks written in reverse dependency order, each `after` the next one's id (task i is `after t{i+1}`). `flat.forEach((_, i) => endOf(i))` starts at task 0, whose start needs task 1's end, whose start needs task 2's end, and so on. Each link costs several stack frames (endOf → memo → compute → startOf → memo → compute → named → map), so a chain a few thousand long overflows the stack, and `compileGantt` throws `RangeError` instead of drawing. A `previous` chain avoids this only because the forEach runs in document order and caches each result as it goes. This one is reasoned from the code, not run.
- evidence: read
- severity: low

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

<!-- done: 7 findings, files read: 44 -->
