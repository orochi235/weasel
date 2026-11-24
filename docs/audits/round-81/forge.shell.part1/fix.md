Answer book evicts answers of configs an open trial still holds (A+B): fixed d60510cae9

Workshop's first render gives stories and the lab theme the declarations' defaults, with `App` unresolved (A): fixed f3ee312ca4. Stories now get the stored globals before the first paint, and a global that follows the app never reaches them as the literal `app`. The lab's own loading screen, shown before its storage opens, still uses the defaults: nothing above the Lab can read the stored values that early.

Dossier keeps its own `$globals` key instead of using `isForgePath` (A): fixed 5cfef0b29f

Host globals not reapplied when `setup` changes (A): fixed 5693ad3ac9. The CSS-override scope (`cssVarsScope`) now follows a replaced setup too, and the stored overrides are put back after it changes.

A story named "Index" loses its breadcrumb step (A): fixed 35c2e1f004. `crumbs` and `breadcrumb` now take the whole entry and use its id to tell a component's index page from a story named Index.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - answers.test.ts: pass
  - answers.pbt.test.ts: pass
  - info/dossier.test.ts: pass
  - hostConditions.test.tsx: pass
  - breadcrumb.test.ts: pass
  - shell.pbt.test.ts: pass
  - tree/StoryTree.test.tsx: pass
  - followLab.test.tsx: pass
  - Also run: TrialHost.test.tsx, TrialHost.copy.test.tsx, info/StoryInfo.test.tsx, FrameView.copy.test.tsx, GlobalsToolbar.test.tsx, Workshop.test.tsx and globalsMenu.test.tsx: all pass
- `npm run checks:gate`: pass, all 33. The first run failed on an unused `useEffect` import, which I removed.
- `npm run check:changesets`: pass, with no warnings on the four new changesets.
- `npm run lint -w packages/forge`: unrun, because forge has no `lint` script ("Missing script: lint"). The gate's root lint passed.
- No browser test files touched.

tally: 5 of 5 fixed, 0 extra fixed