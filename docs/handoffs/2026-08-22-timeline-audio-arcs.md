# Handoff: timeline / rig / audio arcs

**State as of 2026-08-22.** Two feature branches in worktrees, both mid-flight.
Everything durable is in the specs and plans below; this file carries only what
they cannot — where the work sits, and the decisions made in conversation.

## Where the work is

**Both arcs are merged to `main`** (`8e215888` timeline+rig, `1c270ec2` audio)
and pushed as of 2026-08-22 (`5500ea9f`).

All three branches are merged and their worktrees removed. Branches kept:
`animation-timeline`, `audio-engine`, `timeline-audio-demos`.

Check `git worktree list` before assuming anything about the checkout — other
sessions come and go, and the tree can change under a test run. It did once
during this work: five labkit test files appeared as failures and then did not
exist.

**`packages/audio/dist` is gitignored**, so `check-publish-manifests.mjs` fails
on a fresh checkout until `npm run build -w @weasel-js/audio` has run. That is
expected, not a defect.

## The documents

- `docs/superpowers/specs/2026-08-22-game-audio-animation-decomposition.md` — why three arcs, and the order
- `docs/superpowers/specs/2026-08-22-animation-timeline-rig-design.md`
- `docs/superpowers/specs/2026-08-22-audio-engine-design.md`
- `docs/superpowers/plans/2026-08-22-animation-timeline.md`
- `docs/superpowers/plans/2026-08-22-audio-engine.md`
- `docs/superpowers/plans/2026-08-22-timeline-audio-demos.md` — runs after both merge

Both plans were corrected mid-execution as agents found defects in them. The
plan on each branch is ahead of the copy on `main`; take the branch's.

## Decisions that live nowhere else

- **The game demo moved last.** Originally first, as a requirements generator.
  It is now the load test: a platformer drives the timeline and audio harder
  and more continuously than editor interaction does, so it is what exposes
  where the foundations are thin.
- **Tick order is sample-then-fire.** The spec said it, the plan contradicted
  it, the code did what the plan said. Resolved in the spec's favor so an event
  handler sees the current frame's values. The fix agent is applying this.
- **Event dispatch is being rewritten to be stateless.** The cursor `WeakMap`
  and the `event.t > from` window were two independent fire-once mechanisms,
  each masking the other's absence under mutation. `edit()` was the fourth
  hand-synchronized site and nobody updated it, so deleting a keyframe stranded
  the cursor and silently killed every later event. The fix is to drop cursors
  entirely and fire on a binary-searched half-open window — stateless per track,
  so `edit` needs no invalidation at all.
- **Voice identity is a token, not a slot.** A stolen slot is reissued
  immediately, so `release(slot)` from a late `onended` freed the replacement.
  `release`/`setGain` now no-op on token mismatch.
- **Tied voices rotate on steal.** `Map.set` keeps insertion order, so with
  every voice sharing a `startedAt` — the normal case, since one scheduler pass
  gives them all the same engine time — every steal evicted the same slot.
- **`packages/audio` is lint-guarded** against importing any `@weasel-js/*`,
  mirroring the existing `@weasel-js/font` block. `packages/core/src/animation`
  is still outside eslint's `files` scope entirely.

## Traps

- **Do not use `tsc --noEmit -p packages/core/tsconfig.json`.** It exits 1 with
  31 pre-existing `TS6059` errors on a clean tree — that config sets `rootDir`
  to core while the program pulls in `packages/modes`. Use the root
  `npx tsc --noEmit`, which is what `prepublishOnly` gates on.
- **`main`'s lockfile is stale**: all 13 packages sit at 1.0.3 in the lock and
  1.0.4 in their manifests. The audio branch corrects this as a side effect of
  adding its own workspace entry. A new workspace MUST be in the lock or
  `npm ci` refuses the branch, and every workflow starts with `npm ci`.
- **Never commit a worktree's `package-lock.json`** except for that new-workspace
  case, and then only after checking the diff.

## What the demos exposed

Writing the three demos was the point, not a formality — it found two defects
that the whole test suite did not.

- **A finished timeline is unrecoverable.** When a non-looping playhead reaches
  `duration` the tick reports finished and the animator drops the entry, after
  which every `seek()` is silently inert while `time()` and `duration()` keep
  answering. No error, no state change, a control that just stops working. It
  forced `TimelineDemo`'s loop toggle to rebuild the timeline rather than set a
  flag — the largest piece of non-pertinent machinery in any of the three.
- **`engine.register(buffer)` is unusable as designed.** It was added so the
  audio demo could ship without binary assets, but the only way to make an
  `AudioBuffer` is `ctx.createBuffer`, and `AudioEngine` never exposes its
  context. The demo has to build its own and own its lifetime.

Three more gaps, all filed: `mat3` helpers unexported (the rig demo hand-decodes
a `Float32Array`), `BusHandle` write-only with no getters, and `bands()`
returning a widened `Float32Array` where the sibling tap methods return narrowed
ones. Plus three pieces of boilerplate — `keepAlive` for per-frame repaint, a
hand-rolled `onTick` bridge to read the playhead, and a hand-written
`RenderLayer` to draw a skeleton.

**Open question:** `AnimationDemo.tsx` and `EasingsDemo.tsx` are full of inline
styles, which `CLAUDE.md` forbids. Either they are in violation or the rule has
an unwritten exception. The new demos use CSS classes.

## Next

1. ~~Fix the two defects above~~ — done and pushed (`775af743`, `ce472661`).
2. ~~The three filed gaps~~ — `mat3` helpers, `BusHandle` getters and `bands()`'s
   return type all landed in `07632053`. Verify before planning around this
   file; it has been wrong twice.
3. The side-scroller, as the load test on both foundations. **In progress on
   `side-scroller-demo`** — do not start work there without checking who owns
   it; two sessions collided on it once already. `ImageDrawCommand` still has
   no source rect or flip.
4. ~~(P1) No baseline lint~~ — done 2026-08-22, merged as `4edb5c5e`. Eleven
   rules now run over `packages` and `apps`. What stayed off, and why, is in
   `eslint.config.js` and `docs/TODO.md`.

**Still open:** the inline-styles question below, and whether to push.
