---
'@weasel-js/animator': patch
---

A paused looping timeline seeked to its `duration` stays there. It used to wrap to 0 and count a lap on the next frame, so a scrubber dragged to its right end showed the start. The lap is counted, and the events at the end fire, once the timeline plays again. A paused seek past `duration` still wraps.
