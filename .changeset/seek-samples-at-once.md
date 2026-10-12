---
'@weasel-js/core': patch
---

`TimelineHandle.seek` samples the timeline's sampled tracks at once. A target a track holds reads the seeked value straight away, where it used to read the old one until the animator's next frame, so a simulation that seeks a clip and draws in the same frame no longer draws a frame behind. A track's `onTick` is called from the seek as well as from the next frame. Events still wait for playback to advance. `TimelineHandle.edit` samples at once in the same way.
