# Annotations on a lab surface — handoff

Branch `labkit/annotations`, in the root checkout `/Users/mike/src/weasel`.
Run `git log --oneline main..HEAD` for what is on it.

**Read the spec first:**
`docs/superpowers/specs/2026-09-02-labkit-annotations-design.md`. It is current
and approved. This file carries only what the spec cannot: how the decisions
were reached, and what to do next.

## Where the work stopped

**Arc 1 is built, tested and green. Arc 2 is spiked but not built.** Arcs 3–5
are untouched. The spec records all of this; run `git log --oneline main..HEAD`
for the commits.

The next step is arc 2: give `paintInto` / `inputElement` their real shape.
They currently exist on `<Canvas>` labelled SPIKE, and the `tiled-surface` demo
and arc 1's guard tests both depend on them, so they work — but three things are
owed. `canvasRef` is typed `HTMLCanvasElement` and the input element is cast
through it, rather than the ref being widened to `HTMLElement`.
`CanvasExtensionApi.element` has no defined meaning when paint and input are two
elements; it currently returns the input one. And the HUDs (`CursorCoordsHud`,
`PickHud`, `ModalityHud`) drop when detached, because `<Canvas>` returns null
rather than rendering them.

`docs/superpowers/plans/2026-09-02-renderer-target-rect.md` is arc 1's plan with
every box ticked. **Delete it when this branch merges** — a merged plan on disk
reads as open work.

## Decisions made in conversation, not visible in the code

Each of these was chosen against a live alternative. The spec records the
choices; this records that they were *choices*, so they are not silently redone.

- **Weasel scene, not an SVG overlay.** An SVG overlay with geometry as path
  `d` is cheaper on every axis except editing, and is the obvious thing to
  re-propose. It lost because annotating means returning to a mark later to
  select and nudge it, and that is an editor.
- **labkit owns the shared surface; weasel renders into it (2b), not
  `<CanvasView>` over a weasel-owned surface (2a).** 2a needs no core change and
  was explicitly declined — the preference was for closing the engine gap over
  routing around it. It was the fallback until the spike passed; it is now dead.
- **The store is a facade over the scene, not a parallel typed copy.** A typed
  store as truth needs an op→store sync layer, which is the seam a scene-backed
  design exists to delete.
- **`positionDependsOn` belongs in labkit.** I argued the opposite first, on the
  grounds that staleness-against-config is domain semantics. It generalizes: the
  instrument names the keys, labkit snapshots and compares them without knowing
  what any of them mean.
- **The optional meaning tier (`title`/`status` with built-in chrome) is
  deliberate**, so a lab can have labkit own what a mark means without that
  being forced on labs that only want `meta`.

## What the spike settled

The cheap split survives. No preview or chrome layer measures the canvas it
paints into, so `SceneCanvas`'s interactivity assembly does not need factoring
out, and the `<CanvasView>` fallback is retired. The spec's arc 2 has the
evidence and the two findings that came with it.

Worth knowing beyond what the spec records: the failure mode when a pane goes
dead is a console warning about a second dispatcher claiming the
`<ActionsProvider>`, and it looks exactly like broken input plumbing. Both panes
were inert until each got its own `<WeaselProvider isolate>`; nothing about the
pointer path was wrong.

## Traps found while surveying, worth not rediscovering

- **`renderer/WeaselRenderer.ts` already accepts a caller-owned `gl`.** Drawing
  into part of a buffer appears to work, but only because `render()` happens not
  to touch the viewport and the frame clear happens to respect the scissor.
  Neither is documented or tested. Arc 1 is making that real.
- **Nothing in core calls `gl.scissor`,** and `gl.viewport` is called in exactly
  one place. Stencil bits 0–7 are load-bearing for clips and even-odd fills, and
  nothing validates that an injected context has a stencil buffer.
- **brick-icons' lab consumes `@weasel-js/labkit` from npm**, so arcs 1–4 must
  release before arc 5 can migrate it.

## State of the tree, as of this handoff

- `main` is ahead of `origin/main` and has never been pushed. Run
  `git log --oneline origin/main..main`. Pushing needs Mike's explicit say-so.
- **A second session is live in this same directory**, and a third was
  committing in `.claude/worktrees/textprops` (branch
  `ui/selection-text-props`, merged into main but still checked out and in use).
  Do not prune that worktree and do not assume you are alone in the root
  checkout.
