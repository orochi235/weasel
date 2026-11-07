---
'@weasel-js/storage': patch
---

Every adapter deletes a key set to `undefined`, as a record cache already did. localStorage and sessionStorage used to store the text `undefined` and read it back as that string, and the memory and IndexedDB adapters kept the key, listing it with no value.
