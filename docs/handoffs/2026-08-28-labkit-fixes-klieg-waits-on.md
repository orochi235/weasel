# Two labkit fixes klieg is waiting on

For whoever picks up the labkit release. Both fixes are written; neither has reached the consumer
that needs them. This file carries the release chain and one limitation still open — the code and
the changeset say the rest.

## Where the work stands

**The zoom clamp is fixed on branch `zoom-clamp`, worktree `~/src/weasel-zoom-clamp`, one commit
(`c2d3906f`), unpushed and unreviewed.** `usePanZoom` widens its effective range to always admit the
zoom the canvas opened at, and `CanvasStack` and `CanvasCapability` gain optional `minZoom`/`maxZoom`
so an instrument can declare a range up front. The changeset
(`.changeset/zoom-range-admits-opening-view.md`) states the behavior; `packages/labkit/src/canvas/
AGENTS.md` documents it under "Pan/zoom behavior".

**The trial drag handle was fixed on 2026-08-25 and is already on `main`** — `b07b63f8` replaced the
14px grip with a draggable title bar.

**Neither has reached klieg**, which is pinned to `@weasel-js/labkit@^1.1.0`, published 2026-08-22 —
three days before the title-bar commit. Its labs still show the old grip, and its corner lab (now
kliegsminister) opens at `zoom: 1600` against the old hardcoded `maxZoom: 32`, so one wheel event
collapses the canvas 50x and `maxZoom` blocks getting back. That is what "the canvas goes blank on
one twitch" is.

So the remaining work is a **labkit release plus a version bump in klieg**, and a release here is
tag-triggered — a deliberate step, not a side effect of merging.

## The invariant, and the way it gets broken

The fix captures the zoom the canvas opened at, in a `useRef` initializer, and widens the clamp to
admit *that*. Widening to admit the *current* `view.zoom` instead reads as equivalent and is not:
once the user has zoomed out to 32 the current zoom is 32, the maximum collapses with it, and 1600
is still unreachable. `usePanZoom.test.ts` has a test whose only job is to fail under that
substitution — zoom out from 1600, then back, and assert 1600 is reached. Do not "simplify" it away.

An explicit `maxZoom` below the opening zoom does not win; the invariant does. An unreachable
opening view is always a bug, never a configuration.

## Still open: `initialView` is static per instrument

An instrument can now declare its zoom *range*, but still cannot change its view after mount.
klieg's lab hit this from the other side: its `subject: 'letter'` control reframes from one corner
to the whole glyph, and at 1600x the letter has to be zoomed out by hand every time, because
`initialView` cannot be revised. Giving an instrument a way to request a view change is a separate
change to the same surface, and the natural next one.

## Sibling sessions, as of 2026-08-28 evening

`~/src/weasel` was on `panel-body-full-width` with uncommitted work in
`packages/ui/src/components/SidebarPanel/SidebarPanel.module.css`, and two weasel sessions were
live. `zoom-clamp` was cut from `main` into its own worktree for that reason. Check `ListAgents` and
`git worktree list` before writing anywhere in this repo.
