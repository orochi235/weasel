---
'@weasel-js/diagram': patch
---

Clearing `sources` in `useFollowAudioRunner` takes the old buffer away from the live runner.

A file stage stops playing it and reports that it has no source audio.

<!-- entry: fix -->
