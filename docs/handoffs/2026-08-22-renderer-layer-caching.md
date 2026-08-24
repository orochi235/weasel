# Renderer layer caching — handoff

**For:** whoever picks this up next. **Answers:** what landed, where it lives, and what was
decided in conversation that the code does not record.

## Where the work is

**Merged to `main`** at `99783cf2` (2026-08-23); the branch and its worktree are gone. Nothing
pushed. The per-view keying this arc left open landed with virtual viewports, which merged on top
at `f19a8f84` — `drawOneLayer` resolves a layer's commands from cache and then puts them in the
space the layer declares, in that order.

`main` was 19 commits ahead of `origin/main` when this branched — the worktree was created from
`origin/main` by default and had to be reset onto local `main`. `worktree.baseRef: head` is now set
in the repo's gitignored `.claude/settings.local.json` so the next worktree branches correctly.

Full suite green: 677 files, 7079 passing, 3 skipped. Lint clean, `tsc --noEmit` clean,
`check:bumps` OK. Three changesets, all `patch`.

## What landed

- **`RenderLayer.deps` + `LayerCommandCache`** (`core/layers/render.ts`), threaded through
  `drawLayers` and owned across frames by `Canvas` (`canvas/Canvas.tsx`). Opt-in: a layer with no
  `deps`, or a caller with no cache, behaves exactly as before. It skips **rebuilding** a command
  tree, never GPU dispatch.
- **`Stroke.width: { px }`** — screen-pixel width resolved against the **accumulated** transform
  scale during renderer traversal, via `mat3.meanScaleOf`. Not the view: groups nest and compose.
- **`computeFitViewport`** — the viewport fit helper, renamed out from under the minimap
  `computeFitView` that shadowed it at the package entry and made it unreachable.

## Decisions not visible in the code

**Cache keys on layer `id` alone, deliberately.** Keying on the `draw` closure would defeat it
entirely, because React callers rebuild layer objects every render — that is exactly why labkit's
own dirty set was inert. The invariant "an id names the same logical layer across frames" is
documented on `RenderLayer.id`; it predates this work, since `layerById` already deduped by id.

**World-space layers are safe from a stale view; screen-space layers are not.** `drawLayers`
computes `viewToMat3(view)` fresh outside the cache, so a world-space layer omitting `view` from
`deps` still transforms correctly. A `space: 'screen'` layer reading `view` or `dims` must include
them. Documented on `deps`.

**`Stroke.width: { px }` is sugar, not a gap.** Two "renderer gaps" in the original spec were
fabricated — dashed strokes already shipped as `Stroke.dash`/`splitForDash`, and hairlines were
already expressible because `draw` receives the view. `{ px }` was built anyway on its own merits.
Do not reintroduce either "gap".

## Deferred, filed in `docs/TODO.md`

Per-layer GPU dispatch skipping (needs a measurement first, not a build); the closed-subpath dash
seam in `splitForDash`; and the `{px}` stroke thrashing the stroke mesh cache during a zoom, where
exceeding `STROKE_CONFIGS_PER_PATH` clears a path's sibling configurations too.

## What this unblocks

`packages/labkit/docs/superpowers/specs/2026-08-22-canvas-on-scenecanvas-design.md` — labkit's
canvas capability moving onto `SceneCanvas`. Every core prerequisite it named has landed. That
port plan is **not yet written**.

## Traps

**Never `git stash` here.** The stack is shared across worktrees and concurrent sessions. An agent
used it mid-arc and swallowed another agent's uncommitted work; it was recoverable only by luck.
Same for `git reset --hard`, `git checkout -- .`, `git clean`.

**Every changeset is `patch`.** Never write a `bump-approved` marker — that needs an explicit OK in
conversation, every time.

**Test commands:** `npx vitest run --project=kit` for core, `npm test` for everything. The `core`
workspace has no `test` script. Typecheck is `npx tsc --noEmit` from the root — there is no
`packages/core/tsconfig.lib.json`, and the package tsconfig fails on a pre-existing rootDir
misconfiguration even on a clean tree.
