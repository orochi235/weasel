## containsComposed reads an `<a>`/`<area>` root's URL `host` string as a shadow host, then throws
- where: packages/routing/src/interactions/elementAt.ts:23 (containsComposed)
- scenario: `inner` sits in a detached subtree whose top node is an `<a href="https://x.test/…">`, for example a link row dragged with `startThresholdDrag({ captureAt: 'threshold' })` and unmounted before the threshold. No capture means no lostcapture, so the session stays in `OPEN` with a detached origin. `getRootNode()` returns that `<a>`, and `(root as Partial<ShadowRoot>).host` is `HTMLHyperlinkElementUtils.host`, the string `"x.test"`. The loop then calls `outer.contains("x.test")`, which throws a TypeError from `heldWithin` (or from carry's `surfaceAt`) instead of returning false. The function should walk to the host only when `root` is a `ShadowRoot` (`root instanceof ShadowRoot`, or checking `nodeType === 11`).
- evidence: read
- severity: low

## openPointerSession's onEnd says it fires before teardown completes, but teardown runs first
- where: packages/routing/src/interactions/pointerSession/pointerSession.ts:62 (PointerSessionCallbacks.onEnd), 156-160 (end)
- scenario: `end` calls `teardown()` and only then `cb.onEnd(e)`. Inside `onEnd`, `session.active` is already false, the session is gone from `OPEN` (so `heldWithin` no longer sees it), and capture has already been released. The doc ("Fires once, before teardown completes") promises the opposite, so a consumer that relies on it (for example, reading `heldWithin` or still holding capture while it commits) gets different state from what the contract says.
- evidence: read
- severity: low

## Files read
packages/routing/src/interactions/browserReservedKeys.ts
packages/routing/src/interactions/carry/carry.ts
packages/routing/src/interactions/carry/index.ts
packages/routing/src/interactions/elementAt.ts
packages/routing/src/interactions/handleDrag/handleDrag.ts
packages/routing/src/interactions/keyHelpers.ts
packages/routing/src/interactions/pointerSession/index.ts
packages/routing/src/interactions/pointerSession/pointerSession.ts
packages/routing/src/interactions/pointerSession/swallowClick.ts
packages/routing/src/interactions/scratchKey.ts
packages/routing/src/interactions/sweep/index.ts
packages/routing/src/interactions/sweep/sweep.ts
packages/routing/src/interactions/thresholdDrag/index.ts
packages/routing/src/interactions/thresholdDrag/thresholdDrag.ts

<!-- done: 2 findings, files read: 14 -->
