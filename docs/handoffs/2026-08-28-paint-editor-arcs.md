# The paint editor arcs

For whoever picks up arc 4, the last one unbuilt. The design — five arcs, why
each is ordered where it is, the 24 structural switch sites a paint kind
touches — is `docs/superpowers/specs/2026-08-27-paint-editor-design.md`. Read
that; this file only carries what it can't.

## Where the work stands

Arcs 1, 2, 3 and 5 are merged, along with the stroke-dash arc, which is a
different field and was never one of these five. All of it landed on `main` on
2026-08-28. **`main` is 95 commits ahead of `origin/main` and nothing is
pushed.** The merged tree passes typecheck, lint, 8085 tests, a full build and
`check:bumps` / `check:manifests` / `check:frame-loops`.

Only **arc 4 — `PaintInput` in `@weasel-js/ui`** remains.

## What the earlier arcs left you

Arc 3's registry is what arc 4's kind bar is driven by, so read
`packages/core/src/core/paintKinds.ts` before designing the control.
`listPaintKinds()` enumerates every kind, and each entry carries the `label`,
`seed(fromColor)` and `colorOf(paint)` the bar needs, plus an `Editor` slot arc
4 is the first to fill.

Four decisions inside arc 3 depart from the spec, all in the entry's shape:

- **The render slot is `bind`, not `draw`.** A caller owning its own stencil
  state issues its own draw call, so an entry exposing only `draw` would be
  unreachable from the aligned-stroke and even-odd-fill paths.
- **Programs compile on first use**, not through a construction hook — the only
  shape that also covers a kind registered after a renderer exists.
- **Each kit layer keeps its own built-in branch** and consults the registry
  only for kinds it does not recognize. A built-in's render slot lives in the
  renderer and its serialize slot in `@weasel-js/svg`; no one module can own
  all five slots without inverting a package dependency.
- **`FillStyle` stays a closed union.** Opening its discriminant widens every
  built-in member and breaks the narrowing the kit's own branches depend on. A
  registered kind declares its own interface and passes it through `asPaint`.

One capability the spec promised is therefore gone: a fourth gradient can no
longer ride the built-in shader on `u_gradKind == 3`, because
`PaintBindContext` does not expose `ctx.gradFill`. Exposing it would couple a
consumer to `GRAD_FRAG_SRC`'s internal uniform contract. Registering a
gradient-shaped kind now means bringing a shader.

Arc 5 shipped `useNodeOverlayFrame` and `SceneGradientHandles`, so the on-canvas
geometry half of the editor is already done and already handles both paint
slots. Arc 4 is the panel half only.

## Arc 4's three layout decisions

Recorded in the spec's arc 4 section, but they are Mike's and are not derivable
from the code:

1. The kind bar and per-kind editor **take the whole row, label column
   included** — `PaintInput` is a `block` leaf.
2. The section reading APPEARANCE **becomes FILL**, with `appearance` going
   headless (`name: ''`) so FILL and STROKE end up peer sections.
3. Panel bodies already lost their horizontal padding, so the row is 20px wider
   than the spec's screenshots imply.

## Open, not blocked

- **`SidebarPanel`'s title no longer aligns with `SelectionPanel`'s section
  titles** — 8px versus 0 — since the padding change. Either pull `titleButton`
  to `padding: 4px 0`, or keep the inset as a hierarchy cue. Undecided.
- **Consolidate the paint demos into one "stroke and fill" demo.** Filed in
  `docs/TODO.md`; it wants the arc 4 control to exist first.
- **Conic gradients still serialize as nothing.** Now closeable without a kit
  edit: re-register `conic-gradient` with a `toSvg`, and disposing that
  override restores the built-in.

## Traps

**A guard test that passes on the naive implementation is worthless.** Write the
broken version, watch the test fail, then fix. Arc 1's two stencil bugs, arc 3's
frame conversions and arc 5's rotation were all verified this way — arc 5 by
neutering `rotationMatrix` to identity and confirming the guards went red.

**`View` has no rotation field.** The spec asks for a rotated-view test that
cannot be written; a panned, anisotropically scaled view is the strongest
available equivalent, and it is what breaks a two-point translate-and-scale
inverse.

**A local visual pass does not imply CI passes** — Chromium anti-aliases
hairline 2D strokes only on GPU.

**`tsc -p packages/core/tsconfig.json` reports 31 pre-existing `TS6059` errors.**
Typecheck from the repo root instead.

**Another session shares this checkout.** Stage explicit paths, never
`git add -A`, and check `git worktree list` before assuming a branch is yours.
