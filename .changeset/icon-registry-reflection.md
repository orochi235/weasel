---
'@weasel-js/icons': minor
---

`IconRegistry.reflection` lists every icon ref with the table or override behind its glyph and the registrations it displaced.

Each entry's `source` is the table's owner or the override's source; an override sits over the tables at `rank` 1. The registry's storage is now `@weasel-js/registry`'s `createReflectable`, and lookups, overrides and change notifications behave as before.

<!-- entry: api -->
