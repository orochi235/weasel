# Plan: weasel's named easings as blits easing data

**Status (2026-11-26): steps 1–4 and 6 built on branch `easing-presets` (worktree `.worktrees/easing-presets`), not
merged. It cannot merge until a blits release carries `{ linear }`:** against the published 1.4.0, every `linear()`
preset throws when played, so the fleet's typecheck and tests fail. Its tests were run locally, one file at a time,
against blits `main` built from `d283d2fb` and linked into the worktree's own `node_modules/@msb235/blits` (the build
sits in `/private/tmp/claude-501/blits-pkg`, which a reboot clears; `npm run build` in blits and relink to restore it).
Left after the release: bump animator's blits pin, run `typecheck:packages` and `test:fleet`, and step 5's benchmark.
Delete this file when the work merges. The TODO entry is "weasel's named
easings aren't data blits, CSS or the GPU can carry" (`grep -n "named easings" docs/TODO.md`).

**For:** whoever builds it, most likely the session that lands blits' sampled curve.
**Goal:** every geom easing name (`EASINGS`, 30 curves) resolves to a blits `Easing` value: a bezier where one
fits within 0.003, a `linear()` sampled to within 0.001 otherwise. Animator, core and `Clip` play the names
through that table, and geom's functions stay as the reference the table is generated and tested against.

**Blocked on:** blits' `{ linear: [...] }` easing (branch `linear-easing`, `~/src/blits/.worktrees/linear-easing`).
Until a blits release carries it, weasel runs against the local blits checkout and its `@msb235/blits` pin stays on
the published version.

## Decisions (2026-11-25)

- Bezier cutoff 0.003 of output (1.5 px on a 500 px move); `linear()` cutoff 0.001, points placed adaptively.
  Measured: 18 curves take a bezier, 12 take `linear()` at 17–89 points.
- The table lives in animator, which depends on blits; geom keeps no dependencies.
- Bounce stays `linear()` in the table. Exporters write it exactly as keyframes instead (the TODO entry has the
  key times and the two quad beziers); that is the exporters' work, not this plan's.

## Steps

1. **Generator.** `scripts/gen-easing-presets.mjs`: for each `EASINGS` name, fit a CSS bezier by minimizing the
   worst error over 1001 samples (Nelder–Mead from several starts, x clamped to 0..1), keep it if ≤ 0.003, else
   sample a `linear()` by adaptive subdivision to ≤ 0.001 with explicit positions. One progress line per curve
   (`7/30 easeOutCubic bezier 0.0005`). Writes `packages/animator/src/easingPresets.gen.ts`
   (`EASING_PRESETS: Record<EasingName, Easing>`, numbers rounded to what keeps the bound). A working fitter and
   sampler are in the session scratchpad's `easing-err/compute.mjs` and `adaptive.mjs`; port them, don't
   re-derive.
2. **Test.** Beside the table: every entry plays within its bound of geom's function at 1001 points through blits'
   `curve()`, and the generator run in memory reproduces the committed file.
3. **One resolver.** A single `easingFor(spec: EasingSpec)` in animator turns a name into its preset, passes a
   bezier through, and keeps a function as is; every caller of geom's `resolveEasing` that plays an easing goes
   through it: animator's `colorCycle`, `colorHelpers`, `timeline/sampleTrack`, `engine/offsetTween`,
   `engine/tweenAnimation`, `engine/handoff/start`, and core's `animation/rewind` and `animation/index`. ui's
   `CurveEditor/keyframeCurve` draws a curve: it shows what plays, so it reads the preset too, if ui can take the
   dependency; otherwise say so in the report.
4. **`Clip`.** `ClipKey.easing` keeps names; `bindClip` resolves them through `easingFor`. Nothing new is stored.
5. **Numbers.** This changes what runs per frame for a named easing (a blits curve in place of a direct
   function), so per weasel's CLAUDE.md it is benchmarked before and after on one fleet node (`--kind bench`):
   a steady frame of many tweens on a bezier name and on a `linear()` name, raw runs on disk.
6. **Changesets.** One per change: the preset table (minor, new export), the resolver switch (patch, stating
   in prose that named easings now play within 0.003 or 0.001 of the exact curve), `Clip` resolution.
7. **Retire** the TODO entry and delete this plan in the merge.
