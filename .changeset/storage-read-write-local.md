---
'@weasel-js/storage': minor
---

`readLocal` and `writeLocal` read and write one `localStorage` value now, for a setting a first render needs.

They encode a value as `localStorageAdapter` does, and never throw: where the browser refuses storage, `readLocal` answers `undefined` and `writeLocal` answers `false`. `writeLocal(key, undefined)` removes the key.

<!-- entry: api new -->
