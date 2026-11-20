I wasn't allowed to write `.skulk/out/findings.md`, so here is the whole findings document.

# Audit round 47: editing.actions.insert

The brief names frozen commit 44e73a944bea29d4d56fc7883fa302daec48ecf1, but that commit isn't in this clone (`git cat-file` reports a bad object). I read HEAD 782733b19c instead. None of the listed files have uncommitted changes.

## A click ignores snap keys that were rebound: if a tuning or `opts.roles` moves `snap.suspend` or `snap.constrain` off Ctrl or Shift, a click doesn't follow
- where: packages/editing/src/actions/insert/placeAction.ts:55 (placeAction.run)
- scenario: `placeAction` declares `modifierRoles: SNAP_ROLES`, but it calls `snapMods({ modifiers: params?.mods ?? NO_KEYS })` without passing `roles`. `roleReader` (routing/src/interactions/actions/modifierRoles.ts:150) then falls back to the declared keys. The dispatcher only resolves `ctx.roles` for ongoing gestures (`gestureRun.ts:250` → `invocationCtx.ts:133`), never for the params of an immediate run. Say a consumer rebinds `snap.suspend` to Alt. A drag insert then suspends snapping on Alt, but a click still suspends on Ctrl and ignores Alt. So one tool uses two different keys depending on whether the press moved.
- evidence: read
- severity: medium

## A click builds a built-in kind's extras differently from a drag, which contradicts its own doc comment
- where: packages/editing/src/actions/insert/placeAction.ts:59 (placeAction.run)
- scenario: The doc comment says "The rest of the binding's params are the insert's extras, as a drag's are." A drag sends its params through `buildExtras` (extras.ts:8):
  - `rect` and `ellipse` get only `{ kind }`.
  - `polygon` gets `sides: Number(...)` and a `rotation`.
  - `line` gets `a` and `b`.
  - `star` gets its numeric fields.

  A click spreads every param in unchanged (`{ ...params, kind }`). So:
  - A `rect` place binding that carries `fill`, `stroke` or `minSize` hands them to the dep at the top level, as well as inside `extras.style`.
  - A polygon place gets no `rotation`, and `sides` is passed through without `Number(...)`.
  - A `line` place has no `a` or `b` for the line factory to read.

  The question "what are this kind's extras" gets one answer here and another in `buildExtras`. Today the only shipped place binding is sticky, a custom kind, which both paths pass through the same way.
- evidence: read
- severity: low

## A click loses the cleared selection when the `insert` dep's commit throws, but a drag puts it back
- where: packages/editing/src/actions/insert/placeAction.ts:68 (placeAction.run)
- scenario: `run` clears the selection with `deps.operands?.set([])`, then calls `dep.commit(...)`. It restores the selection only when `commit` returns `null`. If a consumer's `insert` dep or node factory throws, the selection stays empty. The drag path wraps the same commit in `try { … } finally { if (!committed) restoreSelection(session) }` (action.ts:104–108), so the same failure there puts the selection back.
- evidence: read
- severity: low

## The preview's `lands` box is wrong inside a rotated or scaled parent
- where: packages/editing/src/actions/insert/lands.ts:24 (insertLanding)
- scenario: `insertLanding` takes how much the quantize rule changes the node's stored pose (`to - from`) and adds it directly to the preview box. That change is in the coordinates of `session.parent`, but the preview box is in world space. Take a scene with `quantize.stored` and an output grid, and draw into a container scaled ×2. The landing box shows only half of each shift and resize, so it doesn't match where the committed node lands. A rotated container applies the change along the wrong axes. The code comment states the assumption, but nothing rules such a parent out: `insertParent` returns a scaled or rotated group without complaint.
- evidence: read
- severity: low

## Files read
packages/editing/src/actions/insert/action.ts
packages/editing/src/actions/insert/commit.ts
packages/editing/src/actions/insert/extras.ts
packages/editing/src/actions/insert/frame.ts
packages/editing/src/actions/insert/geometry.ts
packages/editing/src/actions/insert/lands.ts
packages/editing/src/actions/insert/live.ts
packages/editing/src/actions/insert/params.ts
packages/editing/src/actions/insert/placeAction.ts
packages/editing/src/actions/insert/repositionAction.ts
packages/editing/src/actions/insert/rotateAction.ts
packages/editing/src/actions/insert/session.ts
packages/editing/src/actions/insert/shape.ts
packages/editing/src/actions/insert/style.ts

<!-- done: 4 findings, files read: 14 -->