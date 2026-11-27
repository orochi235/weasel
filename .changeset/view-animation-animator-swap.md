---
'@weasel-js/core': patch
---

A camera runner handed a different animator mid-move still reports, stops, and replaces the move it started on the old one, instead of leaving it running unseen.

<!-- entry: fix -->
