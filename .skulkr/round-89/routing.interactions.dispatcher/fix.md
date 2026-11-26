Tearing down mid-drag leaves the pointer pinned in the view resolver (A): fixed bca79df0d1

Live trace prediction goes stale over a cursor affordance and during a gesture (A): fixed f6a9e0489d

A release on a dispatcher no longer among the live ones unsubscribes it from redraws before its gesture ends (A): fixed 4764c6250e

`explain` reports an open keymap's own Escape binding as firing when dispatch only closes the keymap (B): fixed b0a2075069

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - useGestureDispatcher.teardownUnpin.test.tsx: pass (1)
  - useGestureDispatcher.hoverCursor.test.tsx: pass (10)
  - useGestureDispatcher.leftView.test.tsx: pass (1)
  - dispatcher.keymap.test.ts: pass (18)
  - dispatchRecord.test.ts: pass (10)
  - useGestureDispatcher.heldKeyViews.test.tsx: pass (4)
  - useGestureDispatcher.redraw.test.tsx: pass (7)
  - dispatcherWatch.test.ts: pass (5)
  - useGestureDispatcher.pointerRecovery.test.tsx: pass (10)
  - useGestureDispatcher.longPressView.test.tsx: pass (2)
- `npm run checks:gate`: pass ("checks:gate: all 33 passed")
- `npm run lint -w @weasel-js/routing`: not run, because the package has no `lint` script ("Missing script: \"lint\""). In its place, eslint on every changed .ts/.tsx file: pass (exit 0).
- The tree is clean apart from `.skulkr/`.

tally: 4 of 4 fixed, 0 extra fixed