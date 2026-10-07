---
'@weasel-js/routing': patch
---

`ActionDeps` — the `deps` an action's invoker and `enabled` receive — now types each name through `DepSchema`, so once `@weasel-js/core` is in scope `ctx.deps.scene` is a `Scene | undefined`, `ctx.deps.selection` a `SelectionApi | undefined`, and a dep a consumer merges into `DepSchema` reads back as its declared type, all without a cast. A name nothing declares still reads as `unknown`. This is breaking for code that put a value in `deps` that does not match its `DepSchema` entry, such as a partial stub in a test: that is now a type error where the object is built.
