---
'@weasel-js/prefs': patch
---

Each stored pref record is stamped with the schema version it was written at: a record is now `{ $at: <version>, value: <value> }` where it was the bare value. Migrations run on each record from its own stamp, so a record this build wrote is no longer migrated a second time when a lower `$version` arrives from an older tab or a restore, and a record an older build leaves is migrated when it arrives, whether its `$version` came before it or after.

This changes what is in storage. The first open by this build rewrites every existing record with a stamp; a record with none is read as being at the store's `$version`. A build from before this change that opens the store afterward reads each stamped record as a value it does not recognize and falls back to that pref's default, so do not run the two against one store. Code that reads pref records out of storage directly unwraps `value`. A migration is handed only the records at its own version, and still sees plain values. `runPrefsMigrations` takes `{ stampAll }` in place of its `only` set, and `createPrefsStore` takes the version it stamps with as a fifth argument.
