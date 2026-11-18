- Effect card sliders write an undo step per move, because `EffectBody` has no `draftConfig` (A+B): fixed bbba767e83
- The spline Anchors slider's `onInput` commits instead of drafting (A+B): fixed 665e3d8540
- Shapes lab params differ from what the shapes really take and default to: ribbon `taperWidth` 12 vs 8, cloud's dead `padding`/`roundness` with no `erosion`, plaque missing `sheenIntensity` (A+B): fixed 0787801aaa. It relies on f9d687288b, which adds `badgeShapeDefaults`, `badgeBaseDefaults` and `badgeEffectDefaults` to Badge's catalog (minor changeset). A new `paramParity.test.ts` now holds every shape, base and effect table to those defaults.
- Copy JSX leaves out padding (A+B): fixed e9fad7b7cb
- Effect params missing from the panel: spikes `cornerCompensation` (A+B), sunbeams `color`, aqua/metal `accent` (A): fixed f86fe6f872. Aqua's `accent` defaults to a theme token, so it gets an "Own accent" switch; off, the param is left unset and the badge picks its own color.
- Copy JSX writes the label unescaped (A+B): fixed b2e0ca9912
- A sideways wheel raises an anchor's weight (A): fixed e0a4cb8a38. A wheel event with zero `deltaY` now also passes the gesture on instead of committing an empty step.
- In quadrant mode the editor's far end doesn't match the base, after a mode switch or a count change (B): fixed c80775f5c1
- The spline editor's hit radius is smaller than its heavy dots (B): fixed c6ba59df37
- SplineRow doesn't pass `disabled` to `OctantSplineEditor` (B): fixed bbd1e489d3

Extra defects found while fixing:
- Copy JSX also dropped the label offset and the Type section's font settings, so the snippet still didn't match the stage: fixed 04947fba90
- The scallops effect started at 5/12 in the lab where the effect draws 4/10, and outline's color was hard-coded `#7fb069` where the effect follows `--badge-edge` (outline gets the same "Own color" switch): fixed f86fe6f872
- The effects row ignored `disabled` too, and `EffectList` couldn't be held at all, despite the kit's rule that a component holding value controls takes `HoldProps`. 6400471737 gives `EffectList` `disabled` and `readOnly` (minor changeset); a read-only list still opens and closes its cards. ce574f6317 has the lab pass the row's `disabled` through.

No behavior calls were needed, so `docs/unruled.md` is unchanged. ui-lab has no package manifest, so its lab-only fixes carry no changesets; the two `@weasel-js/ui` changes each have one.

Checks:
- Tests, each run on its own with `--maxWorkers=1`:
  - EffectsRow.test.tsx: pass (1)
  - OctantSplineEditor.test.tsx: pass (7)
  - compose.test.ts: pass (10)
  - sliderUndo.test.tsx: pass (2)
  - splineAnchors.test.ts: pass (17)
  - splineGeometry.test.ts: pass (13)
  - effects.test.ts: pass (7)
  - paramParity.test.ts: pass (47)
  - Badge/catalog.test.ts: pass (4)
  - EffectList.hold.test.tsx: pass (3)
  - Also run: splineUndo.test.tsx pass (1), App.test.tsx pass (4), shapes.test.ts pass (2), EffectList.test.tsx pass (16)
- Each new test failed before its fix.
- No `*.browser.test.*` file was touched.
- `npm run typecheck:packages -- ui`: pass (1/1 ui ok)
- ui-lab isn't a package, so `typecheck:packages` can't take it. I ran the root program instead (`tsc -p tsconfig.json` with typescript-7): pass after one fix, which went into ce574f6317.
- eslint on every changed .ts/.tsx file: pass
- `npm run check:size`: pass
- `npm run check:changesets`: pass (1701)
- `npm run check:token-reads`: pass
- The tree is clean, and `.skulk/` was not touched.