- StorageDemo read `localStorage` raw while rendering (A): fixed a0afacc9a6
- TextShapingDemo used an HTTP error page as a font (A): fixed 2e1d255e1a
- TextShapingDemo reversed every glyph of an RTL line, splitting clusters and flipping LTR runs (A): fixed b9bd1796b5
- SvgDemo exported the old content under the fallback viewBox while the source failed to parse (A+B): fixed aa3400abe1
- StrokeTrimLabDemo's SVG and PDF export rejections had no handler (A): fixed 2f72d6cd6b
- SceneScrollerDemo built a fresh game state on every render (A): fixed febaab8847, plus 458ee15201 (the scene's `initial` memo now reads the lazily built state, which the React compiler lint required)
- ScoreDemo started the score on a disposed engine after unmounting during `unlock()` (B): fixed f38babab04
- StrokeAndFillDemo's pencil factory built a closed polygon (B): fixed 9102668f6f

Extra defects: none.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time, after each file's last edit:
  - `apps/site/demos/__tests__/StorageDemo.test.tsx`: pass (2)
  - `apps/site/demos/__tests__/TextShapingDemo.test.tsx`: pass (3)
  - `apps/site/demos/__tests__/shapedVisualOrder.test.ts`: pass (4)
  - `apps/site/demos/__tests__/SvgDemo.test.tsx`: pass (3)
  - `apps/site/demos/__tests__/StrokeTrimLabDemo.test.tsx`: pass (3)
  - `apps/site/demos/__tests__/StrokeTrimLabDemo.tools.test.tsx`: pass (1)
  - `apps/site/demos/__tests__/SceneScrollerDemo.test.tsx`: pass (7)
  - `apps/site/demos/__tests__/ScoreDemo.unmount.test.tsx`: pass (1)
  - `apps/site/demos/__tests__/ScoreDemo.test.tsx`: pass (3)
  - `apps/site/demos/__tests__/StrokeAndFillDemo.test.tsx`: pass (9)
- Each new test failed against the unfixed code before its fix went in.
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run failed on `react-hooks/preserve-manual-memoization` in `SceneScrollerDemo.tsx`; 458ee15201 fixed it.
- `npm run lint`: exit 0. `apps/site` isn't a workspace package, so I ran the root lint, which covers `apps`.
- No changesets: `apps/site` isn't published, and earlier demo fixes in `git log` have none.
- Tree is clean.

tally: 8 of 8 fixed, 0 extra fixed