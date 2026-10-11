---
'@weasel-js/labkit': patch
---

Opening a lab stored in the four keys labkit used before lab documents lost its tile sizes on the next load: for a `storageKey` with nothing to URI-encode, the old layout key is also the key of the new layout record, and the fold deleted it right after writing it. `openLabStore` now leaves a key it has just written.
