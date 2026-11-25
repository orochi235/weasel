- StrokeTrimLab's palette offers a Select tool its canvas never mounts (A): fixed 6520931dca
- QuantityDemo's BandEditor drops Escape-cancel, so a canceled drag stays shown (A): not a defect. Under the edit protocol (`docs/conventions.md`, "Edit callbacks"), the control sends `onInput` the value the edit began from before it calls `onCancel`, so `live` is already back to the committed bands. A repro test (seam drag, then Escape) passed on the frozen tree, so I dropped it.
- RigDemo's "track u" readout keeps its value after the track stops (A): fixed de68e92cc0. The existing test asserted `track u 1.00` after stop; it now expects `0.00`.
- SvgDemo writes the old scene under the wrong viewBox while the source fails to parse (A): not a defect. `parseSvg` never throws on bad input; it returns `{ nodes: [], error }`. So the scene is emptied and the export is an empty SVG under the default view, which is consistent. A repro test showed exactly that, so I dropped it.
- RegistryDemo's registry is module-level, so entries outlive unmount and are shared between copies (A+B): fixed f0d86f2218
- RigDemo's "joint labels" checkbox also hides both captions (B): fixed d04beed826. The captions now sit on a `captions` layer of their own.
- RepeatAlongLab builds its copies from the schema defaults, not the trial's config, so a seeded trial or a Reset disagrees with the panel (B): fixed 6ade9f854a
- RectPathEditLab's path-edit host outlives a Reset, so a reset trial doesn't reopen rect-1 (B): fixed 1b306a9d2b

Extra defects found while fixing:
- Labs using `defaultPathEdit` don't reopen their path on Reset: question (should labkit's `TrialSceneCanvas` reapply `defaultPathEdit` when the trial resets?). This covers RepeatAlong, Spiro, SegmentType and others. core's `usePathEdit` applies the opening only on mount, and a Reset doesn't remount the trial, so whatever path was open stays open. It's the same gap as the RectPathEdit finding, but the fix belongs in labkit or core rather than a demo, so I left it alone.
- BendAlongLabDemo seeds its effect from `config.defaults()` the same way RepeatAlong did: question (fix it in its own area's pass?). That file is outside this area, so I didn't touch it.

No changesets: these are all `apps/site` demo fixes, and the repo's earlier demo-only fixes carry none. `npm run check:changesets` passes.

Checks:
- `npx vitest run --maxWorkers=1` on each touched file:
  - RectPathEditLabDemo.test.tsx: pass (4/4)
  - RegistryDemo.test.tsx: pass (2/2)
  - RepeatAlongLabDemo.seed.test.tsx: pass (1/1)
  - RepeatAlongLabDemo.test.tsx: pass (2/2)
  - RigDemo.test.tsx: pass (5/5)
  - StrokeTrimLabDemo.tools.test.tsx: pass (1/1)
  - StrokeTrimLabDemo.test.tsx: pass (1/1)
- `npm run typecheck`: pass. `apps/site` is not a package, so I ran the root typecheck instead of `typecheck:packages`.
- eslint on the 10 changed files: pass
- `npm run check:size`: pass ("no file or function grew past its cap")
- `npm run check:changesets`: pass ("OK — 1699 changeset(s)")
- Tree is clean, with 6 commits on top of 815230c6da.