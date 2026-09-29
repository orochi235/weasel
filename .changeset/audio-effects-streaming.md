---
'@weasel-js/audio': patch
---

Insert effects and streaming sources, both additive.

Every bus has an ordered insert chain, `engine.bus(name).inserts`, between where its voices connect and its fader. `inserts.add(effect, { index, bypassed })` returns a slot with `bypass(on)`, `moveTo(index)`, `remove()` and `index()`; `slots()`, `clear()` and `settled()` cover the chain. Every edit is click-free: a bypass crossfades the slot's wet and dry, and an add, remove or move crossfades the old route into the new one, one splice at a time (`insertFadeMs`, default 15). An effect is anything with `input` and `output` nodes, so a consumer's own node pair works as well as the built-ins: `createFilterEffect` (biquad), `createReverbEffect` (convolution from an impulse buffer, with a wet/dry mix), `createDelayEffect` (feedback delay with a mix) and `createCompressorEffect` (with makeup gain).

`engine.stream(elementOrUrl, opts)` plays long audio through a `MediaElementAudioSourceNode` instead of decoding it whole. It returns an ordinary `VoiceHandle` on a bus — `stop(fadeMs)`, `cancelKey`, gain, pan, position and `rate` all apply — but it takes no `when` (a media element's start is not sample-accurate) and no `detune`.

`createBusGraph` gains `input(name)`, the node voices now connect to, and `dispose()`. `node(name)` is still the bus fader, now after the inserts.
