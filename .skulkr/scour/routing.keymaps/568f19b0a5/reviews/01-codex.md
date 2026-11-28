# Review saturation for `routing.keymaps`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. The tracked working tree was clean at the start of review. Scope is the 10 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Pointer identity in gesture capture | 1 | 1 | 0 |
| 2 | Keyboard capture and text composition | 1 | 2 | 0 |
| 3 | Keymap level batching and held leader release | 0 | 2 | 1 |
| 4 | Binding overrides and shortcut descriptions | 0 | 2 | 2 |
| 5 | React subscriptions and contribution registration | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A second pointer can finish or clear another pointer's drag capture

[capturePointer.ts](packages/routing/src/keymaps/capturePointer.ts#L151) · Pass 1 · Medium · Source-traced

Every recognized drag press goes into one shared slot. The release and cancel listeners clear that slot for any recognized pointer without matching its ID against the drag press. Releasing a second pointer can therefore settle the first pointer's drag early or discard it.

### 2. IME composition can be captured as a shortcut

[captureGesture.ts](packages/routing/src/keymaps/captureGesture.ts#L73) · Pass 2 · Low · Source-traced

The keydown handler skips modifier keys but accepts composing events. During composition it can swallow and store an IME key such as Process, or consume a composing Escape as cancellation, even though the ordinary keyboard dispatcher ignores composition input.

Source and tests were left untouched.
