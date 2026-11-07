---
'@weasel-js/editor': patch
---

`reviveTypedArrays` reads a `commands` or `coords` field as an older save's untagged typed array only when it holds numbers. Node data or op args with such a field holding anything else, such as `commands: ['undo', 'redo']` or `coords: { lat, lng }`, used to come back from a reload as a typed array of zeros.
