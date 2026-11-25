I couldn't write `.skulk/out/findings.md` because the write permission was declined, so the whole findings document is below.

# Audit round 38, area `audio.graph`

This checkout doesn't contain the frozen commit the brief names, aac71b545ef36621a62610a7cc0bf3665162b2e5 (`git cat-file` reports a bad object). I read HEAD, 7095f874ee84ae7fc8454ba425cb6ba5ac5bbbe8, instead.

## A non-finite `fadeMs` is accepted, then every fade throws partway through an edit and leaves state behind
- where: packages/audio/src/graph/createAudioGraph.ts:28 (createAudioGraph), with edits.ts:54 (wire) and transport.ts:47 (start)
- scenario: the graph is built with `createAudioGraph(ctx, dest, { fadeMs: NaN })` or `Infinity` on a running context. The engine passes `insertFadeMs` straight through, and nothing checks it there either.
  - `connect('a', { output: true })` adds the edge, marks it `open`, and builds and connects its fader. Then `fader.open(NaN)` reaches `writeParam`, which throws RangeError. The edge stays in the list as open at gain 0, so it's silent. Every later `connect` of the same pair finds it with `findLive` and returns, so that connection can never be made.
  - `start()` sets `playing = true`, then throws from `writeParam` inside `fadeOutput` before any source starts. `isPlaying()` reports true, a second `start()` does nothing, and nothing sounds.
  - It should throw RangeError from `createAudioGraph` itself, as other non-finite audio input does (docs/unruled.md, "Non-finite input to audio…").
- evidence: read
- severity: medium

## A source whose `start` throws stays marked running, so the graph never starts it again, and the edit is left half done
- where: packages/audio/src/graph/wrapper.ts:68 (startWrapper); callers transport.ts:51, edits.ts:101, replace.ts:49
- scenario: `startWrapper` sets `w.running = true` before it calls `def.start`. Take a def whose start throws, such as `createOscillatorNode(ctx, { frequency: NaN })` (next finding).
  - `graph.start()` has already set `playing = true` and begun the output fade-in when it throws at that source. No source after it in `live()` starts. The failing source stays `running`, so later `start()` calls skip it.
  - `add` while playing has already put the node in `nodes` when it throws, so the id is taken even though `add` failed.
  - `replace` while playing has already put the old def in `outgoing`, but hasn't yet scheduled its faders to close. The old def is never released, `busy()` stays true, and `settled()` never resolves.
  - It should mark the source running only after `def.start` returns, and leave no half-applied edit.
- evidence: read
- severity: medium

## `createOscillatorNode` accepts a non-finite `frequency` and throws only at the next start
- where: packages/audio/src/graph/sources.ts:120 (createOscillatorNode)
- scenario: `createOscillatorNode(ctx, { frequency: NaN })` returns a def and stores the NaN. `initParam` only sees it inside `start`, so the RangeError comes from `graph.add` (while playing) or from `graph.start`, far from the mistake and with the state damage described above.
  - `graph.set(..., 'frequency', NaN)` was deliberately made to throw at the write rather than at the next start (sources.shrunk.test.ts:14). `createGainNode` and `createPanNode` throw at construction through `initParam`. This factory option is the only path that still defers the throw.
  - The factory should check the option with `checkParam` or `checkFinite`.
- evidence: read
- severity: low

## `settled()` resolves while a new connection is still fading in
- where: packages/audio/src/graph/edits.ts:95 (busy), edits.ts:54 (wire)
- scenario: on a running context, `connect('a', { output: true }); await settled()` resolves at once.
  - `wire` marks the edge `open` before its fader's 15 ms ramp to 1 has run. `busy()` counts only edges that aren't `open` (deferred or closing), plus outgoing defs.
  - The doc says `settled()` "Resolves once no fade is in flight", and the output fade-in on `start` is tracked (test "settled waits for the output fade-in a start begins"). So the question of whether a fade-in counts as a fade in flight is answered two ways.
  - A caller who reads a `tap` right after `settled()` gets a level that is still ramping.
- evidence: read
- severity: low

## `replace(id, def)` with the def already in that node disposes the live def
- where: packages/audio/src/graph/replace.ts:28 (replaceDef)
- scenario: `graph.replace('osc', oscDef)` is called with the def `osc` already holds, as a reconciler re-applying an unchanged node would.
  - The outgoing entry and the incoming one are the same object. New faders open from it, and once the old faders close, `releaseOutgoing` calls `stop` and `dispose` on it.
  - The live node goes silent and its nodes are disconnected: `sourceShell.dispose` disconnects `output`, and a delay breaks its feedback loop.
  - Nothing refuses a same-def replace or treats it as a no-op. It should be one or the other.
- evidence: read
- severity: low

## Files read
packages/audio/src/graph/createAudioGraph.ts
packages/audio/src/graph/edges.ts
packages/audio/src/graph/edits.ts
packages/audio/src/graph/errors.ts
packages/audio/src/graph/fader.ts
packages/audio/src/graph/playhead.ts
packages/audio/src/graph/processors.ts
packages/audio/src/graph/replace.ts
packages/audio/src/graph/sources.ts
packages/audio/src/graph/transport.ts
packages/audio/src/graph/types.ts
packages/audio/src/graph/validate.ts
packages/audio/src/graph/wrapper.ts

<!-- done: 5 findings, files read: 13 -->