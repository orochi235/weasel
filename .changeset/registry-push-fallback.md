---
'@weasel-js/registry': minor
---

A registry warns in development when a second registrant claims a taken id, unless the first is an engine default marked with `fallback`.

`push(key, value, { fallback: true })` marks a registrant as a default meant to be replaced. Pushing over a registrant of the same rank that is not a fallback logs one `console.warn` per clash, naming the key and both `source`s; pushing over a fallback, or at a higher `rank`, stays silent, and so does `set`. Registering, releasing and registering again, as StrictMode and HMR do, is not a clash. Every `Registrant` and `ReflectedEntry` reports `fallback: true` when it was pushed as one, and an entry now carries its live registrant's `rank` too.

`createReflectable({ name })` names a registry: its reflection reports `name`, and the warning leads with it (`weasel paint kinds: …`), so two registries clashing on one id are told apart. Every kit registry is named, and an extension registry takes its `kind` as its name.

<!-- entry: rank=10 new api behavior -->
