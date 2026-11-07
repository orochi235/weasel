---
'@weasel-js/storage': patch
---

The localStorage, sessionStorage and URL-hash adapters warn about a value holding `-0` or an array with holes, which JSON reads back as `0` and `null`.
