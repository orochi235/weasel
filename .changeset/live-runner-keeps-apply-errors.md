---
'@weasel-js/diagram': patch
---

A live audio stage whose param write or start failed keeps showing its error after edits to other stages.

A failed write is sent again on the next edit; a stage that failed to start keeps its error until an edit naming it lands.

<!-- entry: fix -->
