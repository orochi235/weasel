# The paint editor arcs

For whoever picks up arc 2. The design — five arcs, why each is ordered where it
is, the 24 structural switch sites a paint kind touches — is
`docs/superpowers/specs/2026-08-27-paint-editor-design.md`. Read that; this file
only carries what it can't.

## Where the work stands

Arc 1 is merged. So is the stroke-dash arc, which is a different field and was
never part of these five. Both landed on `main` on 2026-08-28 along with a fix
for the four demos `19d2f0e1` left painting fallback gray. **`main` is 59
commits ahead of `origin/main` and nothing is pushed.**

Arc 1 fixed a live crash: `drawPathStroke` threw on any non-solid stroke paint,
so importing an SVG whose shape carried `stroke="url(#grad)"` produced a scene
that threw on the next frame. The import side was tested into producing exactly
the value the render side refused; nothing covered the two together. It also
stopped a non-solid even-odd fill rendering black.

The seam it introduced — each path-fill painter split into a bind half and a
draw half — is load-bearing for arc 3 and easy to collapse back by accident.
It is written up under Traps in `CLAUDE.md`, with the reason.

## What is next

Arcs 2–5, in order. Arc 2 (the write path, pure core) is the smallest and gates
the rest; arc 3 (the paint-kind registry) gates arc 4 so the kind bar is not
written twice. Arc 5 (the geometry overlay) is independent of 3 and 4 and can
move earlier.

Two decisions already made, not re-litigable from the spec alone:

- **Arc 3 is a full registry, renderer included** — a registered kind brings its
  own shader and needs no kit edits. An editor-only registry was rejected as a
  second place to register the same kind.
- **`setFill`'s black default is arc 2c**, not a drive-by. `setFill.ts:118`
  reads `?? DEFAULT_STROKE_COLOR` where `setFillOpacity` seeds from
  `DEFAULT_FILL_COLOR`. Nothing invokes `setFill` bare, which is why it survived.

## Traps

**A guard test that passes on the naive implementation is worthless**, and both
of arc 1's stencil bugs are invisible without one. Write the broken version,
watch the test fail, then fix.

**A local visual pass does not imply CI passes** — Chromium anti-aliases
hairline 2D strokes only on GPU.

**`tsc -p packages/core/tsconfig.json` reports 31 pre-existing `TS6059` errors.**
Typecheck from the repo root instead.
