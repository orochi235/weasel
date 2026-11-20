## useOpenKeymap's hint goes stale when binding overrides or the action list change while a keymap is open
- where: packages/routing/src/keymaps/useOpenKeymap.ts:12 (useOpenKeymap)
- scenario: a keymap is open (held, or opened with `{ hold: true }`) and the user rebinds one of its keys in a binding editor (`registry.overrideBindings(...)`), or an action the keymap names registers or changes its label/variants. The registry is one stable object (`useActionsRegistry` returns the context value), and `useInnermostKeymap` changes only when the stack notifies, so the `useMemo([open, registry])` never recomputes. The hint keeps showing the old key and label until the keymap closes and opens again, while dispatch already uses the new binding. It should subscribe to `registry.subscribe` (or memo on a registry version) as other registry readers do.
- evidence: read
- severity: medium

## captureGesture ignores a pen-eraser press, which the dispatcher treats as a primary press
- where: packages/routing/src/keymaps/capturePointer.ts:95 (capturePointer, pointerdown listener)
- scenario: the user records a binding with a pen and presses with the eraser end (`pointerType: 'pen'`, `button: 5`). `(p.button ?? 0) !== 0` returns early, so the press is taken from the page but never reaches the recognizer, and no click or drag is captured. The dispatcher's pointer channel classifies the same press with `pressButtonOf` (packages/gestures/src/ui/pressButton.ts:16), which maps the eraser to `'primary'`, so a drag or click binding fires for it on the canvas. The capture and the dispatcher answer "is this a primary press" two ways. The capture should use `isPrimaryPress`/`pressButtonOf`.
- evidence: read
- severity: low

## createKeymapContribution's Escape guard misses a keyHeld Escape binding
- where: packages/routing/src/keymaps/createKeymapContribution.ts:50 (isPlainEscape)
- scenario: `createKeymapContribution({ id: 'k', ..., bindings: [{ spec: { kind: 'keyHeld', key: 'Escape' }, actionId: 'x' }] })` is accepted, because `isPlainEscape` checks only `spec.kind === 'key'`. Escape still closes the keymap (or cancels the gesture in flight) first, so the binding is dead and the hint (`describeKeymap` → "Hold Esc") advertises a key that never runs it. The guard should reject an unmodified Escape of either key kind, as it does for `key`.
- evidence: read
- severity: low

## A capture cancelled by Escape or abort mid-press leaves pointer capture set, and the release's click reaches the page
- where: packages/routing/src/keymaps/captureGesture.ts:58 (captureGesture, done) / packages/routing/src/keymaps/capturePointer.ts:99
- scenario: kinds include `click`. The user presses the primary button on `target` (an Element), so the pointerdown is taken and `setPointerCapture` runs. While still holding, they press Escape (or the signal aborts). `done(null)` removes every listener, resets the recognizer and takes trailing events for one 0 ms task only. The pointer stays captured to `target`, and the later pointerup plus its `click` go to the page untaken, so a control under the pointer (for example the "record binding" button) acts on a press the capture swallowed. Teardown should release the capture (`releasePointerCapture`) and keep taking the held pointer's release and its trailing click.
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

<!-- done: 4 findings, files read: 10 -->
