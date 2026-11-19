- declare() takes its default `speed` from the live rate, not the spec's rate (A+B): fixed 862d3cb3c8
- reset() throws on a `start: 'end'` clock whose run has since become endless (A+B): fixed 44fc275976. I made the strict call: any `duration`, `loop`, `declare` or `override` that would make such a run endless now throws a `RangeError`. Reopening such a clock endless from a recorded position throws too. This is recorded in `docs/unruled.md`. One effect: labkit's transport loop toggle on a `start: 'end'` trial now throws from its click handler, where before it was `reset` that threw later.
- A ramp off 0 doesn't release a hold, so a later declare snaps the playing clock back (B): fixed 5b8ae3160a. The hold now also watches frames and lets go on the first one that moves the clock.
- holdPosition maps an ended run's position to the end of the new run (A): fixed 928cb83e47
- holdPosition splits the recorded position into passes with a bare floor (B): fixed 738c6412a6. B's example numbers don't show it (`500 * 0.1` is exactly 50 in JS). The defect is real for other values, though: `54.91691422425496 / 0.8448756034500764` rounds the pass up to 65. The test uses that case.
- holdPosition sends a recorded pass past the loop to the run's end instead of the last pass (B): not a defect. A hold waits for a target its span can't reach yet ("A time past the pass's end waits at it"). The existing test "waits for a run long enough to reach it, then reaches it" pins this, and `pending` reports the target while it waits.
- PlayheadHold.pending says "clamped", but holdAt returns the raw `shown` (A): fixed 75958c5036 (doc only). The behavior was right and is pinned by tests, since the span may reach that time later. The doc now says what each kind of hold reports.
- A shadowed clock stops being synced, then jumps by the whole time away when it comes back (B): two parts.
  - fixed c2f6f93576: `useClockLoop` rebases any clock that joins its entries, so a clock released and registered again doesn't jump.
  - fixed 9cb2723aa5: the registry's `all()` and `targets()` now include shadowed registrations, so a shadowed clock keeps playing. This was my call, recorded in `docs/unruled.md`. I updated the model in `hold.pbt.test.ts` to match.

No extra defects found.

Checks, run at the tip:
- `npx vitest run --maxWorkers=1`: `declare.test.ts` pass (22), `clock.test.ts` pass (53), `hold.test.ts` pass (22), `hold.pbt.test.ts` pass (4), `useClockLoop.test.tsx` pass (10), `clockRegistry.test.ts` pass (9). I also ran `calls.pbt.test.ts` pass (11), `clock.pbt.test.ts` pass (12) and labkit's `Lab.messages.test.tsx` pass (16) on the way.
- `npm run typecheck:packages -- clock`: pass
- eslint on the changed files: pass
- `npm run check:size`: pass
- `npm run check:changesets`: pass
- Tree clean.