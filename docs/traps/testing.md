# Testing traps

Things in jsdom, vitest and perf harnesses that pass every test and are still wrong.

**jsdom cannot catch a layout collapse.** Arc 3 of the labkit pass wrapped the workspace in a
row whose `flex: 1` resolved to nothing inside a block container, so the lab rendered as an empty
page — with all 7903 tests green. Screenshot anything that changes a container's box.

**A jsdom API that exists but has no consequence produces a test that cannot fail.**
`setPointerCapture` is a real function there: it records the call and does nothing else, so
`pointerup` is never retargeted and the element the browser would synthesize `click` on does not
change. `FloatingPanel` captured on pointerdown — which in a browser kills the click on every
non-native child — and the obvious test, that the child's `onClick` fired, passed before the fix
and after it. This is what makes watch-it-fail the load-bearing half of TDD rather than a step of
write-it-first: when a test written to fail doesn't, you are asserting the emulation. Assert a
proxy on this side of the boundary instead — here, that nothing called `setPointerCapture` — and
say in the test that it is a proxy. A stand-in that drops *cost* rather than behavior does the
same to an efficiency claim: a fake client makes "refetches only when its inputs changed" green
against a hook that refetches unconditionally.

**The CSS-module proxy in the `weasel-ui` vitest project answers to any key.** `s.thisNeverExisted`
comes back as `_thisNeverExisted_<filehash>`, so asserting a class proves only that the component
asked for that key — never that a rule defines it, and a class whose rule was deleted still reads
as present. The hash is per stylesheet, so an assertion can still tell *which* module a class came
from; to know a rule survives, read the stylesheet or check it in a browser.

**Every jsdom test file runs in its own realm (`pool: 'vmThreads'`).** Its `Object`,
`Set`, `RegExp` and `Uint8Array` are not Node's, and `structuredClone` hands back Node's,
so an `instanceof` or `=== Object.prototype` check fails on a clone and `toEqual(new
Set(…))` reports two identical values as different. Use `isPlainObject` from core, or
check the tag with `Object.prototype.toString`. Node globals no longer leak in either — a
browser API jsdom lacks goes in `vitest.setup.ts`. A test that starts a real vite server
belongs in `forge-node`, on the threads pool: rolldown's native binding rejects a foreign
`RegExp`.

**A test file that passes alone and fails in a full run is measuring load, not your
change.** Bisecting with the file in isolation at one end and the whole suite at the
other produced a clean, entirely false "both parents green, merge red" — the two ends
were different experiments. Use one probe across the whole range.

**Run vitest with `--reporter=default` to see a passing test's console output.** The
reporter vitest picks on its own when an agent runs it drops stderr from passing tests, so
React's "not wrapped in act(...)" warnings looked like they only happened in CI. They
reproduce locally once the reporter prints them.

**A windease store notifies its subscribers on a microtask, so a sync `act` ends before
they re-render.** That covers every lab: `Workspace` and `Split` register nodes while they
mount, and every `addTrial`, `rerender` or mark added does the same. Mount through
`renderSettled` (`@weasel-js/react/testing/renderSettled`), and make a store-changing
`act` async, so the notify lands inside it.

**`useScene` builds its scene once into a ref and never rebuilds it.** Editing a demo's
`initial` nodes and saving leaves the previous scene live under HMR, so the canvas paints
the old data with no error and no warning. A hard reload is the only way to trust a
before/after taken in the browser.

**A perf loop driven by hover events measures vsync.** A hover that changes no state does
not dirty the surface, so the loop reports zero uploads as though the caches had absorbed
the work, and a cache that does nothing scores the same as one that works. Count draw
calls alongside whatever else the loop counts.

**A timed-out test keeps running, and its retry gets its aborted `signal`.** vitest 5.0.2 moves on at
the timeout without stopping the test body, so whatever it still posts reaches the next test's
mounts: in `Lab.messages.test.tsx` that read as a play rate of 0 and one state report too many
(2026-10-27). The retry is handed the attempt's already-aborted `context.signal`, so guarding on it
fails every retry at once; guard on a per-test fixture that ends with the attempt instead: labkit's
`live` (`packages/labkit/src/testing/liveTest.ts`), which also logs the stack of each step a failed
test was still waiting on.
