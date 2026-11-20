## Sweep compares item keys with Object.is, so object keys re-enter the same item at every hit-tested point
- where: packages/routing/src/interactions/sweep/sweep.ts:127 (createSweepAction → reach)
- scenario: a grid surface whose `keyOf` returns `{ row, col }` (built fresh per call, which is natural for a generic `K`). Each `reach` gets a new key object, `Object.is(item.key, current.key)` is false, and `run.enter` fires again for the item already under the pointer, once per 4 px step along every move (up to MAX_STEPS = 4096 per move). A toggling run flips the cell back and forth as the pointer moves inside it. The doc promises `enter` only "whenever the item under the pointer changes". Comparing `item.element` (or both) would answer "same item" however `K` is built.
- evidence: read
- severity: medium

## Threshold drag's Escape ignores IME composition, where the pointer session's Escape honors it
- where: packages/routing/src/interactions/thresholdDrag/thresholdDrag.ts:74 (startThresholdDrag → onKey)
- scenario: while a threshold drag is live, the user presses Escape to dismiss an IME candidate window in a focused field (`isComposing: true`). `onKey` cancels the drag and calls `preventDefault` + `stopPropagation` at window capture, so the composition's Escape is eaten too. `openPointerSession`'s own Escape handler (pointerSession.ts:166) returns early on `e.isComposing`. The same decision ("which Escape ends a drag") gets two answers; thresholdDrag re-implements the Escape listener instead of using the session's `escape` option.
- evidence: read
- severity: low

## browserReservedChord checks only `spec.key`, not `spec.code`, so a code-bound spec on a reserved chord passes as safe
- where: packages/routing/src/interactions/browserReservedKeys.ts:55 (browserReservedChord)
- scenario: `KeySpec.code` is "tried before `key`, and either matching is enough" (packages/gestures/src/ui/spec.ts:100). A spec `{ kind: 'key', key: 'π', code: 'KeyP', mods: { mod: true } }` fires on Cmd/Ctrl+P (print), but `lower(spec.key)` yields `['π']`, no reserved chord matches, and the function returns `null`. It should also map `code` values (`KeyX` → `x`) into the keys it checks.
- evidence: read
- severity: low

## Files read
packages/routing/src/interactions/browserReservedKeys.ts
packages/routing/src/interactions/carry/carry.ts
packages/routing/src/interactions/handleDrag/handleDrag.ts
packages/routing/src/interactions/keyHelpers.ts
packages/routing/src/interactions/pointerSession/pointerSession.ts
packages/routing/src/interactions/pointerSession/swallowClick.ts
packages/routing/src/interactions/scratchKey.ts
packages/routing/src/interactions/sweep/sweep.ts
packages/routing/src/interactions/thresholdDrag/thresholdDrag.ts

<!-- done: 3 findings, files read: 9 -->
