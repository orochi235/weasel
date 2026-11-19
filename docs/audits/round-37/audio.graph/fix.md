Non-finite `fadeMs` accepted, edits on a running context fail partway (A+B): fixed 91de12568a. The graph now throws `RangeError` at construction on a `fadeMs` that is not finite or is below 0. Refusing a negative value is my call, recorded in `docs/unruled.md`.

A def whose `start` throws stops the sources after it from starting, and its node stays marked running (B): fixed d1a008babe. `createOscillatorNode` now refuses a non-finite `frequency` when it is built. A source whose `start` throws is no longer marked running, `start()` starts the rest and then rethrows, and `apply` carries on past it the way it does past a throwing `set`. While fixing this I found that a `replace` whose new source throws on start skipped closing the old def's faders, which left the graph busy forever; it now closes them first. Keeping the node in the graph after its failed start is my call, recorded in `docs/unruled.md`.

`settled()` resolves while a new connection is still fading in (B): fixed 79a4432c83. A fader now tracks its open ramp, and `busy()` counts it until the ramp lands.

A non-looping file stopped after its natural end comes back silent on the next start (A+B): fixed 8e39469394. The playhead now restarts a non-looping buffer that reached its end from offset 0.

`replace(id, def)` with the def already live, or one still fading out, disposes the live def (A): fixed 32ac80a55c. `add` and `replace` now throw on any def the graph still holds, and `apply` refuses one before changing anything. The same mistake existed in `add`, where a def shared with another node was double-held, so it is refused too. Refusing a retrigger with the same def is my call, recorded in `docs/unruled.md`.

Checks:
- `npx vitest run --maxWorkers=1 packages/audio/src/graph/createAudioGraph.robust.test.ts`: pass (9)
- `npx vitest run --maxWorkers=1 packages/audio/src/graph/createAudioGraph.test.ts`: pass (32)
- `npx vitest run --maxWorkers=1 packages/audio/src/graph/sources.test.ts`: pass (21)
- `npx vitest run --maxWorkers=1 packages/audio/src/graph/sources.pbt.test.ts`: pass (3)
- `npx vitest run --maxWorkers=1 packages/audio/src/graph/fader.test.ts`: pass (9)
- `npx vitest run --maxWorkers=1 packages/audio/src/graph/replace.test.ts`: pass (14)
- `npx vitest run --maxWorkers=1 packages/audio/src/graph/graph.pbt.test.ts`: pass (1)
- `npx vitest run --maxWorkers=1 packages/audio/src/graph/graph.shrunk.test.ts`: pass (2)
- `npx vitest run --maxWorkers=1 packages/audio/src/graph/wrapper.test.ts`: pass (2)
- `packages/audio/src/graph/graph.browser.test.ts`: unrun (browser test, not touched)
- `npm run typecheck:packages -- audio`: unrun. A PreToolUse hook refused it here as "a suite-sized npm script" and sent it to the fleet, which this brief rules out.
- eslint on the 13 changed `.ts` files, named: pass (exit 0)
- `npm run check:size`: pass ("sizes: no file or function grew past its cap.")
- `npm run check:changesets`: pass ("OK — 1726 changeset(s).")
- Tree clean, `.skulk/` untouched.