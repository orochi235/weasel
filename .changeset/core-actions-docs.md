---
'@weasel-js/core': patch
---

Correct the actions-registry documentation, which described the API that was
replaced in May 2026.

`packages/core/README.md` said `<ActionsProvider>` wires a keydown listener,
showed an `Action` with a `run` callback, and told consumers to reach for
`useSelectAll` / `useEscape` / `useDuplicate` / `useNudge` / `useReorder`. None
of that is true: keystrokes and pointer gestures both route through the gesture
dispatcher matching `defaultBinding`, an action does its work through `invoker`,
and those five hooks were deleted. `docs/taxonomy.md` likewise still listed
`Action.run` and a fallback to a `useKeybinding` path that no longer exists.
