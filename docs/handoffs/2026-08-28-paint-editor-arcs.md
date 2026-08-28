# The paint editor arcs

For whoever picks up arc 3 or 4. The design — five arcs, why each is ordered where it
is, the 24 structural switch sites a paint kind touches — is
`docs/superpowers/specs/2026-08-27-paint-editor-design.md`. Read that; this file
only carries what it can't.

## Where the work stands

Arcs 1 and 2 are merged. So is the stroke-dash arc, which is a different field
and was never part of these five. All of it landed on `main` on 2026-08-28,
along with a fix for the four demos `19d2f0e1` left painting fallback gray.
**`main` is 77 commits ahead of `origin/main` and nothing is pushed.**

Arc 1 fixed a live crash: `drawPathStroke` threw on any non-solid stroke paint,
so importing an SVG whose shape carried `stroke="url(#grad)"` produced a scene
that threw on the next frame. It also stopped a non-solid even-odd fill
rendering black. The seam it introduced — each path-fill painter split into a
bind half and a draw half — is load-bearing for arc 3 and easy to collapse back
by accident. It is written up under Traps in `CLAUDE.md`, with the reason.

Arc 2 landed in the spec's 2c → 2b → 2a order. `setStroke` now takes a whole
`paint`, so a gradient stroke is writable as well as paintable, and
`strokeWith(paint, width?)` joins `strokeOf` as core's constructor for a paint
with no color to pass. The four paint actions collapsed onto `createPaintAction`
— 710 lines to 318, with the four test harnesses becoming one — and the four
suites are byte-identical below their imports, which is what says the collapse
changed no behavior.

One deviation from the spec, worth knowing before reading the factory: its
`readParams` is a reducer over the previous state, not the spec's
`(params) => Partial<TState>`. `setFill` and `setStroke` supersede a paint with
a later color, and no per-field merge of the params expresses that.

Arc 5 landed on `arc5-gradient-overlay` (unmerged). `useNodeOverlayFrame` is
the kit's overlay frame and `SceneGradientHandles` the scene-aware half of
`GradientHandles`; WeaselDraw's copies of both are gone. Selecting the node the
overlay exists to edit turned out to crash the app's properties panel — the
`data.stroke.paint` row read that leaf's schema default as a color string, and
a paint leaf's default is a whole `FillStyle`. Fixed on the same branch.

`View` has no rotation field, so the spec's "a rotated pose and a rotated view"
test is a rotated pose under a panned, anisotropically scaled view.

## What is next

Arcs 3 and 4. Arc 3 (the paint-kind registry) gates arc 4 so the kind bar is
not written twice.

One decision already made, not re-litigable from the spec alone: **arc 3 is a
full registry, renderer included** — a registered kind brings its own shader and
needs no kit edits. An editor-only registry was rejected as a second place to
register the same kind.

## Traps

**A guard test that passes on the naive implementation is worthless**, and both
of arc 1's stencil bugs are invisible without one. Write the broken version,
watch the test fail, then fix.

**A local visual pass does not imply CI passes** — Chromium anti-aliases
hairline 2D strokes only on GPU.

**`tsc -p packages/core/tsconfig.json` reports 31 pre-existing `TS6059` errors.**
Typecheck from the repo root instead.
