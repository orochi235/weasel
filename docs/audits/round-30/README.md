# Audit round 30

Blind pairs at `f10daafb87` (2026-11-16), the same frozen tree and briefs as round 29
(`../round-29/reviewer-brief.md`, `../round-29/fixer-brief.md`), over the two areas round 28 had estimated
held the most: the component kit and diagrams. Reviewer reports are `<area>-A.md` and `<area>-B.md`.

**Not a baseline, and not comparable with round 28.** The reviewers were given an area, not a fixed file
list. Both diagram reviewers read a small share of diagram and diagram-formats (36 and 45 files) and went
to the same recently changed code, which inflates the overlap and shrinks the estimate; round 28's "about
55 left" and this round's "about 12 in all" measure different searches. The ui pair read unequally (8
findings from 72 files against 3 from 60), and its one shared finding is a loose match (Transport readouts
following different locales), so its estimate is a floor.

| Area | Packages | A | B | Shared | Distinct | Est. | Fixed | Questions | Fixer branch |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| ui | ui, ui-input, ui-canvas, ui-logic | 8 | 3 | 1 | 10 | 17 | 8 | 2 | `audit30-ui` |
| diagram | diagram, diagram-formats, diagram-elk | 8 | 6 | 4 | 10 | 12 | 10 | 0 | `audit30-diagram` |

Shared findings, as the controller matched them:

- ui: a component's drawn and spoken numbers (or two readouts) following different locales.
- diagram: `registerMarkShape` throwing beside another mark painter; the unbounded once-per-name warning
  sets; `applyDiagramTheme` and face remeasure throwing on locked content.

ui's two questions (Escape after a sweep across a mixed segment; "No fill" over a partly unfilled range) are
open in `docs/unruled.md`. Extra defects found while fixing: BandEditor's band names spoken in the browser's
locale; a released pool dropping its lanes' members.
