PTouchLabelDemo Download result hidden without WebUSB/Web Serial (A): fixed c556cee620

MermaidKindsDemo parse failure unhandled, previous diagram kept (A+B): fixed 5dcf449b5a

MenuDemo items not owned by a menu, highlight not exposed (A): fixed 40281593e0. Also: submenu rows now carry `aria-haspopup`, `aria-expanded` and `aria-owns`, and Show grid is a `menuitemcheckbox`.

MeasureLabDemo pick survives into the next trial (A): fixed 463474598f. Each trial is its own component, so a new trial was never affected. The real case is Reset: it reloads the same scene object in place, so A's suggested `[scene]` key would not have helped. The fix adds a public labkit hook, `useTrialSceneReset`, which `TrialSceneCanvas` now uses too. Its changeset is at minor, as new API.

LevelOfDetailDemo cards posed in world coordinates under a rigid group (B): fixed bb78289d48

ParallaxDemo tree parts posed in world coordinates under their group (B): fixed 5aad5cf378

PTouchLabelDemo preview drops a `renderLabel` rejection (B): fixed c45590a6cd

Checks:
- Each touched test file, `npx vitest run --maxWorkers=1`: pass
  - LevelOfDetailDemo: 2/2
  - ParallaxDemo: 2/2
  - PTouchLabelDemo: 4/4
  - MeasureLabDemo: 6/6
  - MermaidKindsDemo: 2/2
  - MenuDemo: 2/2
  - labkit useTrialSceneReset: 1/1
  - labkit TrialSceneCanvas.reset: 2/2
- `npm run checks:gate`: pass ("checks:gate: all 33 passed"). The first run failed on labkit lint (biome import order and formatting in my new files); I fixed that and folded it into the labkit commit.
- `npm run lint -w @weasel-js/labkit`: pass
- `npm run check:changesets`: pass ("OK — 295 changeset(s)")
- apps/site is not an npm workspace, so it has no `lint -w`. eslint on its changed files: pass.

tally: 7 of 7 fixed, 0 extra fixed