---
'@weasel-js/registry': minor
---

A key released and registered again in the same tick can keep its place in a registry's order, with `createReflectable({ holdPlace: true })`.

With `holdPlace`, a key whose last registrant is released keeps its place in `entries()` until the current microtasks have run, reading as absent meanwhile, so a React effect that releases and re-registers when its value changes leaves the key where it was.

<!-- entry: api -->
