---
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/path-tools': patch
---

An ongoing action can name the modifiers it reads mid-gesture as roles: `Action.modifierRoles` declares each role's default keys, a tuning's `roles` or a binding's `opts.roles` moves one to other keys, and the dispatcher resolves them into `InvocationCtx.roles` on the press, every move, and the release. `roleReader` reads them, falling back to the default keys where nothing resolved them.

Path edit's modifiers are roles now. `editAnchors` declares `selection.add` (Shift), `mirror.break` (Alt), `handle.holdAngle` (Shift), and `handle.holdLength` (Cmd or Ctrl); `marqueeAnchors` declares `selection.add`; the pen's handle drag declares `mirror.break`, `snap.constrain` (Shift) and `snap.suspend` (Ctrl); and `balanceHandles` declares the two handle locks. So `<SceneCanvas tune={{ editAnchors: { roles: { 'handle.holdLength': ['alt'] } } }}>` moves the length lock to Alt.

Breaking: `locksInForce` takes the invocation context in place of its `ModifierState`, so it can read the roles.
