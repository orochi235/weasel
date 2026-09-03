# Annotations on a lab surface — handoff

Branch `labkit/annotations`, in the root checkout `/Users/mike/src/weasel`.
Run `git log --oneline main..HEAD` for what is on it.

**Read the spec first:**
`docs/superpowers/specs/2026-09-02-labkit-annotations-design.md`. It is current
and approved. This file carries only what the spec cannot: how the decisions
were reached, and what to do next.

## Where the work stopped

The spec is approved section by section, and **the arc 2 spike has run and
passed** — the split works, and the spec now records the outcome in place of the
question. No production implementation exists.

The next step is the arc 1 implementation plan (`writing-plans`). Arc 2's plan
can follow it or run beside it; neither blocks the other any more.

On the branch as a single commit, clearly labelled, is the spike itself:
`paintInto` / `inputElement` on `<Canvas>`, `setTargetRect()` on
`WeaselRenderer`, and `apps/site/spike-arc2.{html,tsx}` behind them. It is a
prototype, not a proposal — it has no stencil check, no guard test, drops the
HUDs when detached, and casts an `HTMLElement` through `canvasRef`'s
`HTMLCanvasElement` type. Arcs 1 and 2 should rewrite it, and `git revert` is
the honest way to drop it if they take another shape. `npx vitest run
--project=kit` (5243 pass) and the visual suite are green against it; the one
red spec, `lab-loupe.spec.ts:115`, fails identically at a clean HEAD and is not
this work.

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
