---
'@weasel-js/labkit': patch
---

An instrument's `serialize` / `deserialize` actually run.

`LabStore.registerSerializers` had no callers, so the map stayed empty: an
instrument whose state is a `Map`, a `Set`, or anything else JSON drops lost it
on reload, on snapshot save and on snapshot load, silently and with no error.
Late registration could never have fixed it either — the store hydrates as it is
built, which is before any provider mounts.

`createLabStore` takes them as `serializers`, and `<Lab>` collects them off its
`instruments`, which is the only place that knows both. `registerSerializers` is
gone with the hole it left; `LabStore` is now the plain store type.

`deserialize` is handed the config the state was saved against — a trial's own
on reload, the snapshot's on load — matching what `Instrument.deserialize`
already declared and never received.
