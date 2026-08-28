# The paint editor arcs, and two bugs found on the way

Two branches are finished and unmerged. Nothing is pushed.

The design lives in `docs/superpowers/specs/2026-08-27-paint-editor-design.md` —
five arcs, why each one is ordered where it is, and the 24 structural switch
sites a paint kind touches. Read that before planning any of arcs 2–5. This file
carries only what it can't: branch state, the open decisions, and two defects
that are nothing to do with either branch.

## Branch 1 — `arc1-nonsolid-stroke-paint`

Worktree `/Users/mike/src/weasel-arc1`. Seven commits, `05f9d75a`..`62a3c46a`.
Arc 1 of the spec, complete.

`tsc`, `npm run lint`, `check:bumps` clean. `npx vitest run --project=kit`:
4981 passed, 2 skipped. One `patch` changeset.

**What it fixes.** The renderer threw on any non-solid stroke paint
(`drawPathStroke`), so importing an SVG whose shape carried
`stroke="url(#grad)"` produced a scene that threw on the next frame. The import
side was *tested into producing* exactly the value the render side refused
(`packages/svg/src/unpack.test.ts:210`); nothing covered the two together.
Gradient-stroked text always worked, because outline text routes through
`drawPathFillByKind`.

**The seam it introduced, which arc 3 also needs.** Each path-fill painter is
now a **bind** half (`bindPathFillSolid` / `bindPathFillPattern` /
`bindPathFillGradient`, dispatched by `bindPathFillByKind`) and a **draw** half
(`drawPathFillByKind`: VAO, `applyClipTest`, `drawElements`). Do not collapse
them back.

The split is not tidiness. `applyClipTest` disables the stencil test at clip
depth 0 and overwrites `stencilFunc` otherwise, so any function owning its own
stencil state — `drawPathStrokeStenciled`, `drawPathFillStencil` — must bind and
draw itself. Calling `drawPathFillByKind` from either one paints the full
doubled ribbon, or fills the holes of an even-odd path, **with every test
green**. Both fixes were validated by writing the naive version first and
confirming the guard test failed on it; keep that discipline for any third
caller.

Also here: a non-solid even-odd fill no longer renders black.

## Branch 2 — `worktree-agent-a9aaa5feca05486b3`

Stroke style (dash) plus the closed-subpath dash seam. Two commits on
`9e378ea0`, two `patch` changesets. Full suite, stories, lint, build all green.

Independent of branch 1 — different field, no overlap.

`Stroke.dash` is edited as a Solid / Dashed / Dotted / Custom bar. Storage stays
`number[]`; presets scale by the sibling stroke width (`dashed = [3w, 2w]`,
`dotted = [1w, 2w]`), so a dash keeps its character across widths.

**Three things to look at before merging**, all defensible, none asked for:

- **`ToolPrefEnum.encoding`** (a `read`/`write` pair) and
  **`PropertyRenderContext.siblings`** are new public schema surface. The
  argument is that `encoding` is the enum counterpart of the `unit` a number
  leaf already has, and `siblings` is what lets a preset read the width it
  scales by. Sound, but it is API arriving through a control change.
- **An object leaf's field written as `undefined` is now removed**, not left
  holding `undefined`. Right for dash — renderer, mesh-cache key and serializer
  all read absent as solid — but it touches every object leaf.
- **`custom` is a disabled segment**, not an inert one: it lights when an
  imported array matches no preset and refuses the click.

The old handoff's decision bullet "Dash has no control. A `number[]` has no leaf
kind" is now false and was corrected in place. The conclusion was wrong, not the
premise: stroke style is an enum, so it never needed an array leaf kind.

## Two defects on `main`, neither branch's doing

**Every node in four demos paints the fallback gray.** `19d2f0e1` ("collapse
node fill and stroke onto their object forms") removed `data.color` from the
painters; no painter reads it now, and ten-plus files under `apps/site/demos/`
still declare it. `npm run test:visual` fails `multi-select`, `quadtree`,
`scene` and `transform` — verified identical to the hundredth of a percent with
`draw.ts` reverted to the merge base, so it is upstream of both branches. **Fix
the demo data, not the baselines.**

**`setFill` defaults to black.** `setFill.ts:118` reads `?? DEFAULT_STROKE_COLOR`
where `setFillOpacity` seeds from `DEFAULT_FILL_COLOR`. Nothing invokes `setFill`
bare, which is why it survived. Queued as arc 2c.

## What is next

Arcs 2–5 in the spec, in order. Arc 2 (the write path) is the smallest and gates
the rest; arc 3 (the paint-kind registry) gates arc 4 so the kind bar is not
written twice. Arc 5 (the geometry overlay) is independent of 3 and 4 and can
move earlier.

Mike chose **full registry, renderer included** for arc 3 — a registered kind
brings its own shader and needs no kit edits. The alternative (an editor-only
registry) was rejected as a second place to register the same kind.

## Traps

**A guard test that passes on the naive implementation is worthless**, and both
stencil bugs here are invisible without one. Write the broken version, watch the
test fail, then fix.

**`tryStageSolid(ctx, mesh, undefined)` flushes the staged run and returns
`false`.** Pass `undefined` for a non-batchable paint rather than hand-rolling a
`flushSolids`, or draw ordering breaks.

**A local visual pass does not imply CI passes** — Chromium anti-aliases
hairline 2D strokes only on GPU.

**`tsc -p packages/core/tsconfig.json` reports 31 pre-existing `TS6059` errors.**
Typecheck from the repo root instead.

**The git stash stack is shared by every worktree of this repo.**
