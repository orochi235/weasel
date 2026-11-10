---
"@weasel-js/animator": patch
---

A timeline frame played backward fires no event. An event at the time a seek landed on fired on the next frame even when that frame played backward, though events fire in forward playback only.
