- A target tween whose path or easing throws at its start leaves the target attached and committed (A): fixed e191831f68
- A refused start's `takeUp` clears the offset waiting beside the committed value before the refusal (A): fixed cbcb560d0d
- A throw from `owner.stop` inside `targets.show()` stops the frame loop, and `stop` quits at its first throwing retire (A): fixed 30b10e813a
- A hold or `holdRows` refuses bad `axes`/`value` only after it has interrupted its key (A): fixed e0e279c546
- `compositor: 'require'` on a spring at rest throws after interrupting (A): fixed 501373137c
- A handed-off tween whose sampling throws leaves its destination committed (A): fixed e045c91102. This also covers a handed-off spring's start and its `setTarget`, and `run.replace` now samples before it swaps.
- Compositor runs are placed against `frameT` on the host's `now()` clock, not the document timeline (A): fixed 429cfb75fa. Each frame of the animator's own loop records the timeline's distance from the frame timestamp, and runs are placed by it. In a browser that distance is 0, so nothing changes there. The test fake's `setup()` now puts in place a `document.timeline` that follows its frame clock.
- A call refused for another animator's target first takes back that animator's compositor run and drops its beside offset (B): duplicate of A's `takeUp` finding (cbcb560d0d). One `TargetBook.check` now runs before any interrupt, release or `takeUp`, in tween, spring/physics, hold, `holdRows` and `openHold`.
- A target's `publish` that throws escapes the frame unguarded and stops the loop (B): fixed c52c52c6fe
- `compositor: 'require'` at-rest refusal comes after the interrupt (B): duplicate of A's at-rest finding (501373137c)
- A throwing interrupt in `register` leaks the codec voice a plain tween or spring cued (B): fixed d8643e34c8
- A taken-back run stays on the table forever when its continuation leaves on the tripwire (B): fixed c5206a83ca

Extra:
- A target tween, spring or hold canceled while its setter throws never let go of the target. The voices weren't stopped, it stayed counted as moving, and no animator could take it (sweep, found while fixing A's show-cleanup finding): fixed d3cd589659. The tween and spring now share one `leaveTarget`, and `leaveHold` is guarded the same way.

Checks:
- `npx vitest run --maxWorkers=1`, run on each touched test file:
  - `engine/offsetStart.refuse.test.ts`: pass (7)
  - `engine/frame.faults.test.ts`: pass (5)
  - `engine/table.register.test.ts`: pass (1)
  - `engine/handoff/handoffStart.test.tsx`: pass (6)
  - `engine/handoff/handoffTripwire.test.ts`: pass (1)
  - `engine/handoff/handoffWall.test.ts`: pass (1)
  - also the whole of `packages/animator`: pass (116 files, 1004 tests)
- `npm run checks:gate`: first run failed 4 of 33 (`typecheck`, `typecheck:packages`, `check:needs`, `check:size`), all from my changes. After fixups squashed into their commits: "checks:gate: all 33 passed".
- `npm run lint -w @weasel-js/animator`: the package has no `lint` script ("Missing script: lint"). `npx eslint packages/animator/src` in its place: pass (exit 0).
- `npm run check:changesets`: pass (one changeset per fix, 11 in all).
- Tree clean; no `docs/unruled.md` entry was needed.

tally: 10 of 12 fixed, 1 extra fixed