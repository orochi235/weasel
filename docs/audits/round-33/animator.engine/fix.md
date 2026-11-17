- Hold layer covers widened with 0s, so a hold on every axis joined on a grown row showed nothing (A): fixed d8004edcad
- Ticks fall out of registration order after a waiting animation wakes or one turns backward (A+B): fixed 710d876643
- A throw from a hold's `value`/`weight`, or a tween's `easing`/`interpolate`/`interpolator`, leaves `framing` stuck true and freezes the animator (A+B): fixed 762c331700. The throwing animation is retired with an `error` event. Any other throw still resets `framing` and asks for the next frame. Recorded in `docs/unruled.md`: a `touch` between frames no longer throws a hold source's error to its caller.
- A handed-off start that falls back to the main thread after interrupting names an id that never registers, and drops the velocity it read (A): fixed 290d091fba. The main-thread starts now take the interrupted id and velocity. Left as it was: under `compositor: 'require'`, the at-rest and `!free` refusals can only be known after the interrupt, so they still throw after it.
- The compositor path interrupts before checking `to`/`from`/`velocity`/spring constants (B): fixed 290d091fba (same commit as the line above, with its own changeset)
- A compositor tween with `ms: Infinity` commits `to`, then `Element.animate` throws (B): fixed f601c6987c
- `retire` asks for a frame from inside a frame's ticks (A): fixed 32472248e6
- `cancelAll` reports `cancel` for an animation already reported ended (B): fixed a177cab1f4
- A throwing `onCancel` leaves rows on the table and stops `retire`/`cancelAll`/`cancelByKey` partway (B): fixed 524ef3d3c3. Recorded in `docs/unruled.md`: everything is cleaned up first, then the first throw goes to the caller. When the animation being retired had already thrown from its own tick, the second throw is logged instead.
- `holdRows` leaves the rows it already took held for good when a later row throws (B): fixed e3a2811101
- A spring interrupting a target tween with an interpolator inherits zero velocity (B): fixed 9f4c011395

Extra defects found while fixing: none. Two follow-up commits:
- 74dcfe50db splits the engine factories my fixes pushed past their `check:size` allowance, and lowers codec's allowlist entry from 139 to 135.
- a18f797fe5 shortens this pass's changeset titles to under 140 characters.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: pass
  - `packages/animator/src/engine/holdStore.test.ts` 10/10
  - `packages/animator/src/engine/frame.due.test.ts` 21/21
  - `packages/animator/src/engine/frame.faults.test.ts` 3/3
  - `packages/animator/src/engine/handoff/handoffStart.test.tsx` 4/4
  - `packages/animator/src/holdRows.test.tsx` 9/9
  - `packages/animator/src/engine/codec.test.ts` 40/40
- `npx vitest run --maxWorkers=1 packages/animator`: pass, 106 files, 947 tests
- No `*.browser.test.*` file was touched.
- `npm run typecheck:packages -- animator`: pass ("1/1 animator ok")
- eslint on every changed `.ts`/`.tsx`: pass
- `npm run check:size`: pass
- `npm run check:changesets`: pass ("[changesets] OK — 1342 changeset(s).")
- Tree clean.