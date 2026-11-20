I couldn't write `.skulk/out/findings.md` because the write was denied, so the whole document is below.

## captureGesture cannot capture a middle- or secondary-button drag, though the dispatcher binds them
- where: packages/routing/src/keymaps/capturePointer.ts:96 (capturePointer, pointerdown listener)
- scenario: a binding editor captures with `kinds: ['drag']` and the user middle-drags, a common pan binding. The listener returns on `p.button !== 0`, so the recognizer never sees the press. `sampleOf` never passes `pointerButton` either. The capture keeps waiting and captures nothing. The recognizer itself turns a middle press into a `drag` once it passes the threshold (`pointerRecognizer.ts` press/move, and its test "goes out as a middle drag"). `DragSpec.button` exists for exactly this, so the dispatcher can bind what capture can never produce. The fix is to feed every button to the recognizer with `pointerButton` and set `button` on the captured drag spec. The comment "only the primary button presses as the dispatcher sees it" is wrong for middle presses.
- evidence: read
- severity: medium

## describeKeymap silently drops a keymap key bound with Ctrl (on a Mac) or Meta (off one)
- where: packages/routing/src/keymaps/describeKeymap.ts:80 (describeKeymap)
- scenario: a keymap binds `{ kind: 'key', key: '1', mods: { ctrl: true } }`. The same spec comes from a user rebinding through `captureGesture`, which on Apple writes Ctrl as `ctrl: true` (`captureSpec.ts` modSpecOf). `keySpecShortcut` returns `undefined` for any spec with `ctrl` or `meta`. The code then falls through to `gestureWords`, which has no word for `key` and also returns `undefined`. The row is skipped, so the hint lists fewer keys than the open keymap answers to. A `keyHeld` binding with those mods is dropped the same way (`gestureWords` → `keySpecShortcut` → `undefined`). Every live binding should get a row.
- evidence: read
- severity: medium

## useOpenKeymap's description goes stale when overrides, tunings or actions change while a keymap is open
- where: packages/routing/src/keymaps/useOpenKeymap.ts:12 (useOpenKeymap)
- scenario: the memo's dependencies are `[open, registry]`, but the registry object never changes identity (`ActionsNode.registry`). What `registry.list()` and `registry.bindingOverrides()` return does change, whenever the tree version moves: an override is pushed or released, an action is registered or tuned, a variant's label changes. Nothing here subscribes to `registry.subscribe`, so while the same level stays open the hint keeps the old keys and labels. `useToolShortcuts` answers the same question by subscribing (`useSyncExternalStore(registry.subscribe, …)`), so the two places disagree.
- evidence: read
- severity: low

## Events after a capture settles outside the press's own task reach the page
- where: packages/routing/src/keymaps/captureGesture.ts:66 (captureGesture, done)
- scenario:
  - **Right-click on macOS/Linux:** `contextmenu` fires at mousedown, so the capture settles then. By the time the button comes up, the 0 ms `TRAILING` guard has expired and the listeners are gone. The release's `pointerup` and `auxclick` reach the page.
  - **A key or abort mid-press:** the same happens when Escape, a captured key or an abort settles while a primary press is held. `stopPointer` resets the recognizer, and the later `pointerup` and `click` go through untaken.

  `TRAILING`'s doc says these events are taken "or the page acts on a gesture already captured". To keep that promise, the guard has to last until the held pointer comes up, not for one task.
- evidence: read
- severity: low

## A completed click held back for a double click is discarded when a key arrives in the window
- where: packages/routing/src/keymaps/captureGesture.ts:76 (keydown listener), with capturePointer.ts:57
- scenario: kinds include `click`, `doubleClick` and `key`. The user clicks once, then presses a key within `doubleClickMs`. The click's timer is still pending, so the keydown calls `done({ kind: 'key', … })` and `stopPointer` cancels the click. The capture resolves to the second input, though the doc promises "the next input", which was the click. A key should either flush the pending click first or be ignored while one is pending.
- evidence: read
- severity: low

## Files read
packages/routing/src/keymaps/captureGesture.ts
packages/routing/src/keymaps/captureKey.ts
packages/routing/src/keymaps/capturePointer.ts
packages/routing/src/keymaps/captureSpec.ts
packages/routing/src/keymaps/createKeymapContribution.ts
packages/routing/src/keymaps/describeKeymap.ts
packages/routing/src/keymaps/index.ts
packages/routing/src/keymaps/keymapStack.ts
packages/routing/src/keymaps/useInnermostKeymap.ts
packages/routing/src/keymaps/useOpenKeymap.ts

<!-- done: 5 findings, files read: 10 -->