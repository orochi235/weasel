---
'@weasel-js/cursor': patch
---

When a cursor sink's `element()` starts answering another element, the old one gets back the cursor it showed before the sink wrote there, whether the sink had written a base or an override to it.

<!-- entry: fix -->
