texture exported as a dangling `url()` with no fallback (A): fixed 543ca2610d
white seed written as `#fff`/`white`/`rgb()` ramps white to white (A): fixed 92e64953b5
lazy kind failing registration dropped silently (A): fixed d6004b91b0
`withPaintKind` skips an override of a built-in gradient kind (A): fixed e7581deb3f
gradient `colorOf` reads `stops[0]`, not the lowest offset (A): fixed 47e850eaa6
lazy kind failing its stopsOf/fromStops check logs nothing (B): duplicate of A's lazy-registration finding, d6004b91b0
`getPaintKind` decides whether to load from the renderer's registry, so the editor half never loads (B): fixed 3fc3f451c1. Draw-kind loaders take a new `has` option, with a `minor` changeset for `@weasel-js/renderer`
white seed (B): duplicate of A's white-seed finding, 92e64953b5
`meshGradientKind` doc names a nonexistent `./registerMesh` (B): fixed 097b59a008

Notes:
- The texture fix makes the export write `url(#patN) none`, because a texture has no color to fall back to. `GradientEditor`'s filter uses the same `nativeSvgKind`, so it is fixed by the same change.
- 3fc3f451c1 adds `packages/paint-kinds/src/paintKinds.test.ts`, which holds the tests for the four paint-kinds fixes before it as well. Each of its tests failed before its fix.
- `getPaintKind` now calls `warmPaintKinds` when its own registry misses on a kind the renderer knows. For a kind registered only with the renderer and no loader, that allocates an empty promise on each lookup.

Checks:
- `npx vitest run --maxWorkers=1` on each file:
  - packages/paint-kinds/src/paintKinds.test.ts: pass (10)
  - packages/paint-kinds/src/svgNative.test.ts: pass (2)
  - packages/svg/src/patterns.test.ts: pass (19)
  - packages/core/src/core/paint/paintKinds.test.ts: pass (26)
  - packages/core/src/core/paint/meshKind.test.ts: pass (23)
  - packages/renderer/src/paintKinds.loaders.test.ts: pass (6)
  - packages/renderer/src/paintKinds.pbt.test.ts: pass (1)
  - packages/renderer/src/paintKinds.programs.test.ts: pass (4)
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- `npm run check:changesets`: pass
- `npm run check:size`: pass
- `npm run lint -w <pkg>`: none of paint-kinds, renderer or svg has a `lint` script ("Missing script: lint"). Instead I ran `npx eslint` on every changed `.ts` file: pass.
- Tree is clean.

tally: 9 of 9 fixed, 0 extra fixed