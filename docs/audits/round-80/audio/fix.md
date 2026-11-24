createDelayEffect throws on its default time when given a short maxTime (A): fixed a6d24f9a6e

createDelayEffect throws on a maxTime under 250 ms unless time is given (B): duplicate of the finding above

patternVoicePeaks loops once per pass across a long finite tail and hangs (A): fixed 5d7cb6e84d

An unknown bus is dropped as `locked` before unlock but throws after it (A): fixed c0b2a339d0. The bus is now looked up before both the locked and the disposed checks, so a misspelled bus also throws after dispose.

SoundCache keeps every buffer for the engine's lifetime, with no way to release one (B): fixed aa39444102. This adds `free` to the engine and to `SoundCache`, adds `SoundCache.clear`, and makes `dispose()` free every sound. Its changeset is `minor` because it adds API.

release() before `when` either cancels the voice or plays a release tail, depending on lookahead timing (B): fixed d081f26cb4. This needed a behavior call, recorded in `docs/unruled.md`. A release before `when` now always cancels with `onDrop('stopped')`, as the `VoiceHandle.release` doc says, on both node and worklet voices. This reverses the unreleased `4050c90ff2`, so I deleted its pending changeset (`audio-node-note-released-early.md`) and rewrote its test.

Checks:
- `npx vitest run --maxWorkers=1` on `effects.test.ts`, `patternLoad.test.ts`, `patternLoad.pbt.test.ts`, `patternLoad.shrunk.test.ts`, `createAudioEngine.onDrop.test.ts`, `createAudioEngine.synth.test.ts`, `createAudioEngine.worklet.test.ts`, `soundCache.test.ts`, `soundCache.pbt.test.ts` and `createAudioEngine.lifecycle.test.ts`: all pass.
- I confirmed the two new release tests fail without the fix.
- `packages/audio` `npm test`: pass, 101 files and 816 tests.
- `npm run checks:gate`: pass, "all 33 passed".
- `npm run lint -w @weasel-js/audio`: not run, because the package has no `lint` script. The gate's root `npm run lint` passed.

tally: 6 of 6 fixed, 0 extra fixed