# Annotations on a lab surface — handoff

Branch `labkit/annotations`, in the root checkout `/Users/mike/src/weasel`.
Arc 1 is merged, so the branch and `main` currently point at the same commit —
`git log --oneline origin/main..main` is the whole body of unpushed work.

**Read the spec first:**
`docs/superpowers/specs/2026-09-02-labkit-annotations-design.md`. It is current
and approved. This file carries only what the spec cannot: how the decisions
were reached, and what to do next.

## Where the work stopped

**Arc 1 is built, merged and green. Arc 2 is spiked but not built.** Arcs 3–5
are untouched. The spec records all of this.

The next step is arc 2: give `paintInto` / `inputElement` their real shape.
They currently exist on `<Canvas>` labelled SPIKE, and the `tiled-surface` demo
and arc 1's guard tests both depend on them, so they work — but three things are
owed. `canvasRef` is typed `HTMLCanvasElement` and the input element is cast
through it, rather than the ref being widened to `HTMLElement`.
`CanvasExtensionApi.element` has no defined meaning when paint and input are two
elements; it currently returns the input one. And the HUDs (`CursorCoordsHud`,
`PickHud`, `ModalityHud`) drop when detached, because `<Canvas>` returns null
rather than rendering them.

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

- **brick-icons' lab consumes `@weasel-js/labkit` from npm**, so arcs 1–4 must
  release before arc 5 can migrate it.
- **The GL recorder used to make renderer assertions that could not fail.**
  `SCISSOR_TEST` was missing from its constants table so the Proxy answered 0,
  and `drawingBufferHeight` is lowercase so it answered a *function*. Both fixed
  in arc 1, but the shape recurs: anything ALL-CAPS the table does not know is
  silently 0, and anything lowercase is silently a recording function.
- **A perf measurement that drives hover events measures nothing.** A hover that
  changes no state does not dirty the surface, so the loop times vsync while
  reporting zero uploads as though the caches had absorbed the work. Count draw
  calls alongside whatever else you count.

The two traps this section opened with — the renderer's viewport never being
touched in `render()`, and nothing validating an injected context's stencil —
are what arc 1 fixed. See the spec's arc 1, not this list.

## State of the tree

- **`main` has never been pushed**, and is a long way ahead of `origin/main`.
  Pushing needs Mike's explicit say-so, every time.
- **`main` is checked out in `.claude/worktrees/trunk`**, so the root checkout
  cannot `git switch main` — git refuses a branch checked out elsewhere. To
  merge a branch into `main`, run `git -C .claude/worktrees/trunk merge
  --ff-only <branch>` after merging `main` into the branch first. Leave that
  worktree in place.
- No other session was in this directory at handoff time, but that changes
  without warning. Check `git status` before staging, and stage explicit paths.
- The full gate is `npx tsc --noEmit && npm run lint && npx vitest run
  --project=kit`, plus `npx playwright test --config=tests/visual/playwright.config.ts`.
  All four were green at the merge. Note that `npm test` does **not** run the
  visual suite — that gap is how a red spec reached `main` earlier today.
