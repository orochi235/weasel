---
"@weasel-js/core": patch
---

Two components that pass one snap source object to `useSnapSource` each hold their own registration: unmounting one leaves the source snapping for the other.

<!-- entry: fix -->
