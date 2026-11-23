# Audit round 74 — audio — findings

## afterRamp's cancel does not cancel when it is armed while the context is suspended
- where: packages/audio/src/audioTime.ts:62 (afterRamp, `arm`)
- scenario: `afterRamp` called while `ctx.state === 'suspended'`. `atAudioTime` runs its callback synchronously (a non-running clock fires at once); the callback adds the `statechange` listener and sets `cancel` to the function that removes it. Then `atAudioTime` returns and `cancel = atAudioTime(...)` overwrites that with atAudioTime's own canceller, which is a no-op now (`live` is already false). The returned cancel therefore leaves the listener on: on resume `onState` re-arms and `cb` runs even though the caller canceled it. Reachable from graph/transport.ts `fadeOutput` (afterRamp armed with `deps.fade()` regardless of state), e.g. stop() during a suspension then start(): the old fade's `then` (stop the sources) fires after resume over the new start. Should: assign `cancel` before the callback can run, or have the callback's assignment win.
- evidence: read
- severity: medium

## afterRamp ends a ramp at once when the context is 'interrupted' rather than 'suspended'
- where: packages/audio/src/audioTime.ts:58-64 (afterRamp)
- scenario: Safari (and the current spec) have an `interrupted` state. The timer fires while the context is interrupted; `atAudioTime` sees a non-running clock and calls back; the callback only waits when `state === 'suspended'`, so it calls `cb()` mid-ramp, and `onState` likewise re-arms on 'interrupted'. The insert crossfade/fader cut then happens halfway through its ramp once the clock runs again — the click afterRamp exists to avoid. Should: wait on any non-running, non-closed state.
- evidence: read (inference about the `interrupted` state on Safari)
- severity: low

## setTempo from a scheduler callback in the same batch as the player's next step doubles the step chain
- where: packages/audio/src/patternPlayer.ts:270-277 (setTempo)
- scenario: `engine.schedule(t, () => player.setTempo(140))` with `t` landing in the same scheduler pass as the player's pending step booking (or `setTempo` from another player's `onStep`, where this player's `inStep` is false). `fireDue` has already taken the step's entry out of the queue, so `engine.cancelKey(key)` cancels nothing (the scheduler documents this), and `setTempo` books a new step. The old entry still fires, plays the step and books its own next step: two step chains run from then on, every event playing twice. Should: mark the booking as taken (e.g. a booking generation the fire checks) rather than relying on cancelKey.
- evidence: read
- severity: medium

## A sound handle that is undefined/null leaks a live voice instead of dropping it
- where: packages/audio/src/createAudioEngine.ts:104 (bufferStarter.ready), packages/audio/src/voices.ts:110 (startVoice)
- scenario: `engine.play(handles.kik)` where `loadAll`'s key is misspelled (undefined). `launch` takes a chain and registers the voice; when it comes due, `ready()` throws reading `sound.id`. `startVoice` only guards `starter.start` with try/catch, so the throw escapes to the scheduler's catch-and-log: the voice is never torn down — it holds a chain on the bus, stays in `live`, `isPlaying()` is true forever, and no `onDrop` arrives. Should: drop it as `unready`/`failed` (guard `ready()` too, or check the handle at the call).
- evidence: read
- severity: low

## A fractional voiceLimit admits one voice more than the limit
- where: packages/audio/src/voicePool.ts:46 (checkVoiceLimit), :80 (acquire)
- scenario: `createAudioEngine({ voiceLimit: 2.5 })` or `createVoicePool({ limit: 1.5 })`: `checkVoiceLimit` accepts it (only `>= 1`), and `live.size < opts.limit` lets 3 (resp. 2) voices sound before stealing. The chain pool is also sized `2.5 * buses`. Should: require a whole number, or floor it.
- evidence: read
- severity: low

## The kernel's noise-loop cache grows without bound across sample rates
- where: packages/audio/src/voiceKernel.ts:159-169 (noiseLoop)
- scenario: `renderNoise(noise, sampleRate)` called at many distinct sample rates (offline renders at the rate of each target, resampling sweeps): each `color:rate` pair keeps a 2-second Float32Array (≈384 KB at 48 kHz) in a module-level Map forever; nothing evicts. The context-side `noiseBuffer` is per context (collected with it), so only this cache leaks. Should: cap it (as `PERIODIC_WAVE_CACHE` does for waves).
- evidence: read
- severity: low

## Files read
packages/audio/src/analyser.ts
packages/audio/src/audioTime.ts
packages/audio/src/biquad.ts
packages/audio/src/buses.ts
packages/audio/src/createAudioEngine.ts
packages/audio/src/effects.ts
packages/audio/src/envelope.ts
packages/audio/src/impulse.ts
packages/audio/src/index.ts
packages/audio/src/insertPlan.ts
packages/audio/src/insertPump.ts
packages/audio/src/insertRoute.ts
packages/audio/src/insertSlot.ts
packages/audio/src/inserts.ts
packages/audio/src/lerp.ts
packages/audio/src/liveVoice.ts
packages/audio/src/oscillator.ts
packages/audio/src/param.ts
packages/audio/src/patchCheck.ts
packages/audio/src/patternLoad.ts
packages/audio/src/patternPlayer.ts
packages/audio/src/pbt.fixture.ts
packages/audio/src/periodicWave.ts
packages/audio/src/pitch.ts
packages/audio/src/resumeWatch.ts
packages/audio/src/scheduler.ts
packages/audio/src/score.ts
packages/audio/src/scoreBar.ts
packages/audio/src/scoreMood.ts
packages/audio/src/soundCache.ts
packages/audio/src/spatialize.ts
packages/audio/src/streamStarter.ts
packages/audio/src/synthStarters.ts
packages/audio/src/synthVoice.ts
packages/audio/src/tickTimer.ts
packages/audio/src/types.ts
packages/audio/src/voiceChains.ts
packages/audio/src/voiceDrops.ts
packages/audio/src/voiceKernel.ts
packages/audio/src/voicePool.ts
packages/audio/src/voices.ts
packages/audio/src/worklet/loadVoiceProcessor.ts
packages/audio/src/worklet/protocol.ts
packages/audio/src/worklet/voiceMixer.ts
packages/audio/src/worklet/voiceProcessor.gen.ts
packages/audio/src/worklet/voiceProcessor.ts
packages/audio/src/worklet/workletVoices.ts

<!-- done: 6 findings, files read: 47 -->
