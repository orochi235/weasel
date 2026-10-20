---
'@weasel-js/diagram': patch
---

Add `@weasel-js/diagram/effect-audio`, which plays an audio pipeline through a patchable `@weasel-js/audio` graph. `createLiveAudioRunner` (and the `useLiveAudioRunner` hook) edits the graph as the pipeline changes, so a delay keeps its tail when another stage is tweaked. `AUDIO_STAGE_TYPES` is the palette, `audioStageNodes` maps each stage to its graph node, and `drawScope` and `drawSpectrum` draw a stage's output into its preview. `@weasel-js/audio` is an optional peer dependency.
