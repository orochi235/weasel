# Config migrations for labkit instruments

For whoever builds or reviews this in weasel. It answers one question: how an
instrument that renames a config key keeps the value a user already stored
under the old one.

## The problem

As a lab loads, `createLabStore` fills each stored config from its
instrument's defaults. Filling makes an old config load, but it cannot move a
value: rename `gridSize` to `grid.size` and the old key is kept while the new
one sits at its default.

## Design

- **`Instrument.migrateConfig?: (stored: unknown) => unknown`.** It takes the
  stored config and returns it with values moved to where the current schema
  keeps them. It only has to move things; the defaults fill whatever is still
  missing afterwards.
- **It runs on every read, not once.** Nothing records a config's version, so a
  config already moved comes through again and must be returned unchanged. A
  version number would change the stored record format for every lab, to save
  instruments one `if` apiece; checking for the old key is the whole cost.
- **Where it runs:** the same hydration step as the fill, in `hydrateTrials`
  and `hydrateSnapshots`. That covers a lab's first load, its saved snapshots,
  and records another tab writes, and the deserializer gets the moved config.
- **Plumbing** follows `configDefaults`: `CreateLabStoreOptions.configMigrations`
  is keyed by instrument name, and `<Lab>` collects it with
  `configMigrationsOf(instruments)`.

A moved config is not written back until the trial next changes; storage keeps
the old shape until then, and the next load moves it again.

## Tests

`openLabStore`: a renamed value moves before the fill, on a trial, on a
snapshot, into the deserializer, and on a record another writer stores.
`configMigrationsOf` keys only the instruments that declare one.
