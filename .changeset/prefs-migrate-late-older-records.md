---
'@weasel-js/prefs': patch
'@weasel-js/storage': patch
---

Prefs migrate records that arrive after the open. When another writer leaves an older `$version`, as an older build open in a second tab does, the store runs its migrations from that version over the records other writers changed and persists the result; before, it ran on the older-shape records for the rest of the session. Records a failed first read delivers late are migrated the same way, and a value set before they arrived is left as it was set. `runPrefsMigrations` takes a third argument, the names to migrate, for that. Another writer deleting `$version` is read as a cleared store, and migrates nothing.

Breaking for a caller of `watchPrefsVersion`: it takes the migrations, `watchPrefsVersion(cache, migrations)`, where it took their count.

`OwnedRecordCache` gains `onOverruled(listener)`, which reports another writer's changes the cache did not take because its own write to the record was queued or on its way. The prefs version watch listens there too, so a newer build's `$version` still stops this build persisting when it lands during this build's own write of that record.
