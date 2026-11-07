---
'@weasel-js/core': patch
'@weasel-js/devtools': patch
---

Devtools serialization no longer writes a value it cannot send as JSON as a string that could be mistaken for one of the app's own. NaN and ±Infinity, a bigint, a symbol, a function, a cycle, a getter that threw, a cut past the depth limit and a cut past the item limit each arrive as an object tagged with what it was (`{ $type: 'number', value: 'NaN' }`, `{ $type: 'cycle' }`, …). A plain object's own keys that start with `$` arrive with one more `$` in front, so an app's own `$type` stays data, and the count of keys cut from an object arrives as `$more`. The panel reads the tags, so a node whose data holds the string `'[cycle]'` or a `$type` field shows them as they are.

This changes the shape `serialize` returns, so anything reading `SerializedValue` beside the panel has to read the tags. `@weasel-js/core/devtools-protocol` exports `SerializedTag`, `unescapeKey` and `serializedNumber` for it.
