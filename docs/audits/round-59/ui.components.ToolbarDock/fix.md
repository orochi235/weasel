RTL drop slot with one other bar in the row (A): fixed 83274b14ad

RTL side dock columns measured physically, so drops into existing columns fail (A+B): fixed 7b3d33ce59

RTL empty-dock drop strip drawn on the wrong side (A+B): fixed de94aa7d4e

The next drag measures the held layout but applies its move to the host's layout (A+B): fixed 5700633f8c

resolveLayout throws on a malformed stored layout (A): fixed ffcb7c3b03, plus 7f07d9d618 (a typecheck fix for the same change)

A dock whose bars are all hidden can never take a dragged bar (B): fixed 5a7b25a1fa

Alt+ArrowLeft/Right move the bar the wrong way in RTL (B): fixed 07abbff72d

Drag and refocus queries also reach a ToolbarDock nested in the workspace (B): fixed c944d81adf

A bar's least length stays after its reporter unmounts, and the per-bar caches never drop removed bars (B): fixed ca662af25d

Extra defects: none. ad9e53f7b3 only shortens four of my own changeset titles that `check:changesets` rejected for running over 140 characters.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: dockDrop.test.ts 7 passed; layout.test.ts 32 passed; layout.pbt.test.ts 4 passed; useDockDrag.test.tsx 38 passed; ToolbarDock.float.test.tsx 20 passed; ToolbarDock.test.tsx 10 passed; ToolbarDock.ends.test.tsx 13 passed; ToolbarDock.along.test.tsx 1 passed. The Bar directory, which uses `useReportDockLeast`, also passed: 234 tests.
- Unrun: `ToolbarDock.browser.test.tsx`, which has a new RTL empty-strip test and can only run in a browser.
- `npm run check:changesets`: pass.
- `npm run checks:gate`: the first run failed (`typecheck` and `typecheck:packages`, TS2345 in layout.ts). After 7f07d9d618, "checks:gate: all 32 passed".
- `npm run lint -w @weasel-js/ui`: there is no such script, because `@weasel-js/ui` has no `lint` script. `npx eslint packages/ui/src/components/ToolbarDock`: pass, exit 0.
- Tree clean.

tally: 11 of 11 fixed, 0 extra fixed