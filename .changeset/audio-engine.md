---
'@weasel-js/audio': patch
---

New package: a Web Audio engine for 2D scenes, with no weasel dependencies.

Loading and decoding with a url cache, voices with handles and `cancelKey`,
buses with gain/mute/solo, 2D spatialization, and analyser taps including
`bands(n)` for audio-reactive rendering. This is all new API surface.

Playback is lookahead-scheduled on the engine's own timer rather than triggered
from an animation frame, because `AudioContext.currentTime` is hardware-driven,
cannot be paused, and `requestAnimationFrame` throttles when backgrounded.
