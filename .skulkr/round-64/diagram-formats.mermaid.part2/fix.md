State diagram: several start/end shapes in one scope merge, or a start reads back as an end (A+B): fixed d1903c9b38
Radar ids rewritten for Mermaid collide (A+B): fixed d23b09ff9f
Sequence box/rect fill the reader doesn't take as a color is still written (A): fixed 9911164c31
Kanban mint seeded with ids the board never writes (A+B): fixed 5b87a0b47c
Kanban writer renames ids that are flowchart keywords (A): fixed ee93236a45
Labeled state diamond loses its outline silently (A+B): fixed 39f7289a78
Multi-line state note loses blank lines and leading spaces (A): fixed dc1e58a2ad
Requirement writer names a box from a row past the divider (A): fixed 4b0b8336b0
Quadrant class names the reader can't take corrupt the point or the file (A): fixed 98f79bb13f
Chart writers drop the page name silently when it differs from the title (A): fixed 2088a58963
Mind map cloud written with bang brackets (B): fixed 62d9165210
Sequence page named by an empty title statement over its front matter title (B): fixed b85f701d3a
State description given before `state "…" as` is thrown away (B): fixed 46476f273a
Xychart drops a front matter title without the warning other charts give (B): fixed 1dd1d0ba98
Packet field with an empty label lost as a gap (B): not a defect (`docs/unruled.md`, ruled 2026-11-11: "A packet field with an empty label reads back as the gap the writer spells the same way")

Extra, found while fixing: none counted separately.
- The front-matter-title warning was copied inline in five chart readers. It now lives once in `readPageName`, which is part of 1dd1d0ba98.
- `mermaidIds` gained a `keywords` option, so the kanban and radar writers no longer apply the flowchart keyword list.
- Behavior calls I made are recorded in `docs/unruled.md` (7a41a58e46):
  - state `[*]` shapes are warned of rather than the page being refused;
  - a labeled diamond is written as a plain state with a warning;
  - chart page names are warned of rather than written as front matter;
  - a sequence page named `''` now reads back unnamed. A sequence property test was updated to match.

Checks:
- Each touched test file, run one at a time with `--maxWorkers=1`: pass (kanban, mindmap, pie, quadrant, radar, requirement, sequence read/pbt/write, state, timeline, xychart). The mermaid root and common test files: pass.
- `npm run checks:gate`: pass ("checks:gate: all 32 passed"). The first run failed three steps: typecheck and typecheck:packages (two TS2352 test casts), and check:changesets (eight titles over 140 characters). I fixed them and folded the fixes into their commits with an autosquash above the frozen base.
- `npm run lint -w packages/diagram-formats`: the package has no lint script (its only scripts are build and test). I ran eslint on every changed `.ts` file instead: pass (exit 0).
- No browser test files were touched. The tree is clean.

tally: 14 of 15 fixed, 0 extra fixed