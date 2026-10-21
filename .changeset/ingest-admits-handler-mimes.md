---
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

A drop or paste now keeps string flavors of any exact MIME a registered content handler names in its `match` or `types`, for as long as it stays registered, so a handler can claim a drag from the app's own UI by a type of its own instead of tagged `text/plain`. Globs and `application/octet-stream` admit nothing. `admitIngestMime(mime)` (routing, re-exported from core's ingestion module) does the same for code outside the handler registry and returns a release. The kit weasel-JSON handler's `application/x-weasel-clipboard+json` flavor now reaches it on paste as well.
