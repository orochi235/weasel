Mind map loop with no root, A+B: fixed 62076af3a5
Mind map drops a diamond's second connector with no warning, A: fixed 62076af3a5 (same commit as the loop fix)
xychart throws on `accTitle : x` and `accTitle:x`, A: fixed 5f7a3fb85b (the xychart parser now reads its lines through `statementsOf`, like the other kinds)
xychart rejects a bare-word axis title, A: fixed 5f7a3fb85b (it now takes one bare word as a title, for series names too)
xychart silently accepts an unclosed `%%{` or `accDescr {`, A+B: fixed 5f7a3fb85b
Sequence and xychart readers drop `accTitle` instead of naming the page by it, A: fixed a3bb819301 (sequence), 5f7a3fb85b (xychart)
Sequence box split when its members aren't adjacent, or loses created and message-only members, A+B: fixed ac38b0954d (members are declared together with a warning when that moves one; a created member is warned of and stays outside the box)
Sequence writes a non-finite `autonumber` that its own reader rejects, B: fixed ac38b0954d (written as plain `autonumber`, with a warning)
State note text read from `lines` only, ignoring `rows`, A: fixed 71f4b73fa5
State note joined from its state is dropped and its edge reads back as a phantom state, A+B: fixed 71f4b73fa5
State writer writes `note right of [*]`, which its reader rejects, A+B: fixed 71f4b73fa5 (dropped with a warning)
State note's edges past its first dropped silently, A: fixed 71f4b73fa5 (now warns)
State reader drops a class on `[*]`, A: fixed 71f4b73fa5
State writer moves a top-level state into a composite through the composite's `[*]`, A: fixed 71f4b73fa5 (that transition is dropped with a warning)
Kanban writer leaves out `column-N`/`card-N` ids the reader won't give back, A: fixed 90f9e251f0 (it now simulates the reader's id minting)
Kanban writer renames ids with a `-` or a leading digit, A: fixed 90f9e251f0 (`mermaidIds` takes a new `id` option for the kanban's own id pattern)
Requirement names that differ only in `"` vs `'` merge into one block, A+B: fixed 6373166ffb (quotes are rewritten before names are made distinct, with a warning)
Requirement writer drops colors on a quoted name with no warning, A: fixed 6373166ffb (now warns)
Requirement writer drops text rows before the divider, and rows of other kinds, silently, B: fixed 6373166ffb (now warns)
Radar with an empty `title` statement hides its `accTitle`, A: fixed 4ee1d476bc

Extra defects found while fixing:
State writer drops a start or end state's colors with no warning, sweep: fixed 71f4b73fa5
Pie, quadrant, packet, timeline, radar and xychart drop `accTitle` silently when a title statement names the page, and a blank front-matter title hid an accessible one, sweep: fixed 4ee1d476bc (`readPageName` takes the title statement's text as a new third argument)
8 changeset titles ran over 140 characters: fixed 0ed38fb7a0

The mind map, xychart, sequence-writer, state, kanban and requirement commits each hold several fixes, because they shared files and hunks. Each fix still has its own changeset. Every behavior call here is a strict one that warns. None needed a new `docs/unruled.md` entry, since each follows the existing "dropped, with a warning, so it reads back" rulings.

Checks:
- `npx vitest run --maxWorkers=1` on each touched test file (mindmap, xychart, sequence write and read, state, kanban, requirement, radar, common/lines), then the whole `packages/diagram-formats/src/mermaid` directory: pass, 42 files, 415 tests
- `npm run check:changesets`: pass ("OK — 2046 changeset(s).")
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- `npm run lint -w @weasel-js/diagram-formats`: not run, because the package has no `lint` script (npm reported missing script). `npx eslint packages/diagram-formats/src/mermaid`: pass
- No `*.browser.test.*` file was touched.
- The tree is clean, and nothing in `.skulk/` was changed.