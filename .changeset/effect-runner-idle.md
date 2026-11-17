---
'@weasel-js/diagram': minor
---

`EffectRunner.idle()` settles once every run and step asked for so far has finished.

A caller that owns the source images it hands the runner awaits it before closing a replaced one, since no run reads that image after.

<!-- entry: api -->
