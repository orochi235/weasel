# Findings: routing.interactions

## browserReservedChord misses Cmd+Shift+[ / ] for a spec bound by `code`
- where: packages/routing/src/interactions/browserReservedKeys.ts:84 (keysOf)
- scenario: on Apple, `{ kind: 'key', key: '[', code: 'BracketLeft', mods: { mod: true, shift: true } }`. `KeySpec.code` matches the physical key "whatever a held modifier makes it type", so this binding fires on Cmd+Shift+[, which Safari and Chrome take as "previous tab". `keysOf` maps `BracketLeft` only to its unshifted key `[`. The reserved `[` entry requires shift released, and the reserved `{` entry is never compared because `{` is not among the spec's keys. So `browserReservedChord` returns `null` when it should return the "previous and next tab on macOS" chord. The same happens with `BracketRight` / `}`. Digits avoid this only because `345` and `#$%` are both listed.
- evidence: read
- severity: low
- size: function
- cause: code-to-key map ignores the shifted character
- confidence: likely

## A sticky rect element feeds its own drag back into its coordinate space
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:112 (stickyScrollerOf), 87 (scrollersOf)
- scenario: `scrollersOf` starts at `rectEl` itself, so `sticky ??= n` picks `rectEl` when it is `position: sticky`. That includes the default case, where `rectEl` is the HTML handle target. On a stuck axis, `moved()` then reads `box.getBoundingClientRect()` live on every move. If the drag moves that handle (`transform`, `left`/`top`), its rect changes and `localOf` shifts the origin by the same amount. That breaks the contract stated in the doc comment that a handle moving under its own drag must not shift the space its coordinates are reported in. The reported point then drifts or oscillates. The fix is to measure the sticky offset in a way the box's own movement cannot affect, such as its offset against the scroller minus the scroller's scroll at press, or to skip `rectEl` itself.
- evidence: read
- severity: low
- size: function
- cause: live rect of the box being measured
- confidence: likely

## A sweep surface whose items sit in its own shadow root never reaches an item
- where: packages/routing/src/interactions/sweep/sweep.ts:82 (itemAt)
- scenario: the surface is a custom element that renders its toggles in its own shadow root. `elementAt(surface, …)` hit-tests in the tree the surface belongs to (the document), not in `surface.shadowRoot`, so it returns the host, which is `surface` itself. The loop `for (; el && el !== surface; …)` exits at once and returns `null`. `enabled` then answers `NotApplicable`, so the sweep never starts. Items in a nested shadow root inside the surface come back retargeted to their host, so `keyOf` sees only the host, and `el.parentElement` stops at shadow-root boundaries either way. The carry and pointer-session code count shadow content as inside its host (`containsComposed`); the sweep does not.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/sweep/sweep.ts, packages/routing/src/interactions/elementAt.ts
- size: function
- cause: hit test not descending into the surface's shadow root
- confidence: likely

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

<!-- done: 3 findings, files read: 14 -->
