---
"@weasel-js/diagram": patch
---

Live audio judges feedback loops only over the wires it plays, so a stray wire no longer silences the stages around it.

A wire to a port its stage lacks, or through a stage that is not audio, closes no loop.

<!-- entry: fix -->
