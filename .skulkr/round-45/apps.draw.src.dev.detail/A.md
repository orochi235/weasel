## Gesture and phase-output details tell the reader about a phase grammar and `initial.overlay` that no longer exist
- where: apps/draw/src/dev/detail/GestureDetail.tsx:88-91, 117, 123 (GestureDetail) and :135-142 (PhaseOutputDetail)
- scenario: Open any gesture entry. The blurb says tools "subscribe to it via the legacy phase grammar" and the grid is headed "Tools subscribing (phase grammar)". But `ToolSurface.gestures` is built from `Tool.bindings` ("a tool has one binding list now, not an initial and an engaged route table", registryEntries.ts:34-36), and `PhaseDef` is gone from every package's `src` (grep finds none). The Overlay output's blurb says "Only `initial.overlay` is read by the runtime today", which names a phase-table field that no longer exists. The final `claimsAll` branch is unreachable, since `PHASE_OUTPUT_KEYS` is only `cursor`/`overlay`, and it describes a dispatcher that registryEntries.ts:26-28 says was removed. The inspector's own explanatory text misdescribes the current API.
- evidence: read
- severity: low

## Action-binding rows on a gesture detail collide when two bindings differ only in fields the route text drops
- where: apps/draw/src/dev/detail/GestureDetail.tsx:83 (GestureDetail, row id) with :18-21 (describeGestureSpec)
- scenario: The row id is `${actionId}::${specKind}::${bindingText}`, and `bindingText` comes from `routesForSpec`. That function encodes only phase, gesture, arg, target, mods and hover `held` (packages/routing/src/tools/routing/reflection/registry.ts:113-129), and drops `code`, `when`, `view`/tier and the BoundGesture's `opts`. Take an action whose `defaultBinding` holds two specs of one kind with the same key and mods that differ only in `code`, `opts.params` or a `when`, e.g. `{kind:'key', key:'0', mods:{mod:true}}` and `{kind:'key', key:'0', code:'Numpad0', mods:{mod:true}}`. Both get the same DataGrid row id, so React sees duplicate keys: one row can be dropped or reused on sort. Each binding should get its own row. The binding's index, or `opts.id`, would make the key unique.
- evidence: read
- severity: low

## Files read
apps/draw/src/dev/detail/BundleDetail.tsx
apps/draw/src/dev/detail/ExportsDetail.tsx
apps/draw/src/dev/detail/GestureDetail.tsx
apps/draw/src/dev/detail/IconDetail.tsx
apps/draw/src/dev/detail/KindDetail.tsx
apps/draw/src/dev/detail/MetaDetail.tsx
apps/draw/src/dev/detail/OpDetail.tsx
apps/draw/src/dev/detail/RouteBadge.tsx
apps/draw/src/dev/detail/SlotDetail.tsx
apps/draw/src/dev/detail/shared.tsx
apps/draw/src/dev/detail/sourceLinks.tsx

<!-- done: 2 findings, files read: 11 -->
