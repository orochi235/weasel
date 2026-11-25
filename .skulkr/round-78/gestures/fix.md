Fixed: modifier legends, aliases, describeRoute prose and field defs, root filter, preserve-3d/offset-path, multitouch tap timing, 3→2 restart.

keyLegendFromKey draws modifier keys by their raw name (A): fixed 1a0500d78e

keyLegendFromKey ignores the `Esc`/`Space` aliases the matcher accepts (A): fixed 1a0500d78e

describeRoute prints raw target forms as nouns, e.g. "on a affordance:handle:nw" (A): fixed bd53160be6

ROUTE_FIELD_DEFINITIONS.target describes a target form routeToSpec rejects (A): fixed bd53160be6. The definition now lists the forms routeToSpec accepts.

fixedSeat treats a `filter` on the root element as a fixed containing block (A): fixed aa21329197. `backdrop-filter` and `will-change: filter` on the root are exempt too.

hover `leave` never fires after leaving its target with a button held (A): not a defect. With no `held` hover binding, `hoverCursor` (routing) sends no hovers while a button is held, so `from` stays on the target and the leave fires on the first move after release. With a `held` binding present, `docs/unruled.md` (2026-10-20) already rules that a leave from one target to another during a press reaches only `held` bindings.

two-finger tap timed from the second finger, so it fires during a drag or after a long hold (B): fixed 5ee97b7f6a. The tap is now timed from the first finger's press and refused when any finger was already spent. The model fixture was changed to match.

going 2→3 fingers doesn't end the old gesture; going 3→2 leaves nothing running (B): fixed 6670701e28. The 2→3 half was already handled: the dispatcher cancels the 2-finger handle (`gestureRun.ts`). For 3→2, the recognizer now dispatches the remaining fingers' geometry after the end event, so a 2-finger gesture starts. This is my call, recorded in `docs/unruled.md`. The routing test `useGestureDispatcher.multitouch.test.tsx` now expects the restart.

fixedSeat misses `transform-style: preserve-3d` and `offset-path` (B): fixed aa21329197

formatShortcut keeps a leader step's optional shift (B): not a defect. `formatShortcut` prints only each leader step's label, never its keys, so the leader's shift never reaches the string. `formatShortcutParts` already marks it as an optional chip.

describeRoute target prose and inaccurate ROUTE_FIELD_DEFINITIONS (B): duplicate of A's describeRoute and ROUTE_FIELD_DEFINITIONS findings, fixed bd53160be6. The `phases` definition now also names the `*` phase.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - keyLegendsFromMods.test.ts: pass
  - keyLegendFromCode.test.ts: pass
  - keyLegendsFromShortcut.test.ts: pass
  - describeRoute.test.ts: pass
  - fixedSeat.test.ts: pass
  - pointerRecognizer.test.ts: pass
  - pointerRecognizer.eventTime.test.ts: pass. Its new tests failed against the old recognizer.
  - pointerRecognizer.pbt.test.ts: pass
  - multiTouch.pbt.test.ts: pass
  - multiTouch.shrunk.test.ts: pass
  - routing multitouchCount.test.ts: pass
  - routing useGestureDispatcher.multitouch.test.tsx: pass
- `npm run checks:gate`: "checks:gate: all 33 passed"
- `npm run lint -w @weasel-js/gestures` and `-w @weasel-js/routing`: fail, "Missing script". Neither package has a lint script. eslint on every changed file: pass.

tally: 9 of 11 fixed, 0 extra fixed