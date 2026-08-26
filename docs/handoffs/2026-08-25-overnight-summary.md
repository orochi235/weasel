# Overnight run, 2026-08-24/25 — what landed

**Read this first.** Three branches, none pushed, none merged — that is your call. Each has its own
handoff with the detail; this file is the map.

| branch | worktree | state |
|---|---|---|
| `worktree-frame-loop-decoupling` | `.claude/worktrees/frame-loop-decoupling` | two arcs complete, each independently reviewed, review findings fixed |
| `mac-pinch-zoom` | `.claude/worktrees/mac-pinch-zoom` | complete |

Final gates on the frame-loop branch: **7469 passing, 2 skipped**, `tsc` clean, `lint` clean,
`check:bumps` OK (3 changesets, all `patch`), visual baselines 36 passed / 3 skipped locally.
`mac-pinch-zoom`: 7383 passing, clean.

## What was asked, and what happened

**Frame-loop decoupling** (`2026-08-24-frame-loop-decoupling` (plan, deleted at merge), 11 tasks).
The canvas paints from its own `requestAnimationFrame` loop instead of a React render, and the view
moved into a ref with `getView`/`setView`/`subscribeView`/`subscribeFrame`/`getPaintedVersion` on the
handle. `SceneCanvas` renders `Canvas` uncontrolled unless a consumer passes `view`. Details and the
measured result are in `2026-08-24-frame-loop-decoupling.md`.

**Camera animation** (`2026-08-25-camera-animation` (plan, deleted at merge), 9 tasks). Your
option 1: `animatedZoom` implemented on the animation system, `useViewTween`'s bespoke rAF loop
deleted. Cmd+=/-/0 glide with a geometric scale curve and a fixed anchor; wheel and pinch still jump
per sample by design; any pan cancels a glide. Verified in a headed browser on a real Mac — Cmd+=
glided 1.25 to 1.5625 over ~30 frames with the anchor world point holding exactly.

**Mac trackpad pinch** — the bug you reported. Root cause was not what either of us guessed: a
trackpad pinch is `wheel { ctrlKey: true }`, and `mods: { mod: true }` is platform-*exclusive*, so on
Mac it requires `meta` and leaves `ctrl` forbidden. Nothing matched, nothing called `preventDefault`,
and the browser's native page zoom ran. Fixed on its own branch along with two others, including that
**the entire test suite was running as non-Mac** — jsdom's `navigator.platform` is `''`, which is not
nullish, so a `??` fallback to the user agent never fired. Every Mac-specific binding in this repo
was untested.

## Both arcs were reviewed after they "finished", and both reviews found a Critical

The frame-loop arc: `syncPaint` + `subscribeFrame` recursed without bound — 21 paints from one
request, capped only by the probe. The changeset itself prescribed `subscribeFrame` as the remedy for
the loupe's stale readback, so the documented fix would have hung a `syncPaint` tab.

The camera arc: on a *controlled* canvas nothing could interrupt a glide, and the glide silently
overwrote the consumer's own camera — demonstrated by writing a pan mid-glide and watching it revert.
Three code comments and the spec asserted the opposite.

Neither was reachable by the test suite as written. Both are fixed.

## The part worth your attention

**A green suite meant nothing here, repeatedly.** Over these arcs the test suite stayed green through:
a canvas that painted nothing at all under StrictMode in every demo (7379 tests passing), custom
shaders silently never compiling, a zoom factor applied twice, text double-click-to-edit broken for
twelve days, four demos double-applying the view transform, and a minimap drawing its nodes at 2-4 px
instead of 11-22 px while looking plausible.

**Eight tests passed against their own mutations** before being tightened — including one written
into a plan that could not fail in either direction, because TypeScript allows a value-returning
function where `void` is declared.

Everything of consequence was caught by exactly two things: mutation-testing each test, and putting
eyes on a running browser. Both are now written into the plans' "How to test" sections. If you keep
one habit from this, keep those.

## Before merging

The two branches **collide in three files** — `SceneCanvasProps`' `animatedZoom` declaration,
`viewportZoom.ts`, and the `viewport.pinchZoom` wiring. Whichever goes second needs a rebase.

Also: two commits on the frame-loop branch share the subject "give the canvas view an imperative
setter, getter and subscription" (`f0822a01`, then `feed266d` with review fixes) — an amend that
raced an intervening commit. Content is correct and linear; reword or squash when merging.

The per-branch pre-merge checklists are in the other two handoffs. Neither says "the suite is green".
