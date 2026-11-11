---
"@weasel-js/audio": patch
---

`spatialize`, and so a spatial voice, keeps its gain and pan finite at the ends of the double range. A source past the double range is silent, or at whole gain with a rolloff factor of 0; a reference distance of 0 silences everything past it, as documented.

<!-- entry: rank=-5 fix -->
