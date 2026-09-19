---
"@weasel-js/core": patch
"@weasel-js/routing": patch
"@weasel-js/ui": patch
---

Remove the `pointer` dep. **Breaking:** `DepSchema` no longer has a `pointer`
entry, `useStandardActions` no longer takes a `pointer` option, and the fixed
deps bag handed to an action that declares no `requires` no longer carries it.

Nothing in the kit declared or read it, and `<SceneCanvas>` never supplied a
value, so an action reading `deps.pointer` was already getting `undefined`. An
action that wants the pointer reads it from its invocation context
(`ctx.world`), and code outside an action can still use `usePointerContext()`,
which is unchanged.
