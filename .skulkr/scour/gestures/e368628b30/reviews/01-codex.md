# Review saturation for `gestures`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 44 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Pointer release coordinates and drag threshold classification | 1 | 1 | 0 |
| 2 | Keyboard control ownership across shadow boundaries | 1 | 2 | 0 |
| 3 | Multitouch episodes, long-press lifecycle, and click memory | 0 | 2 | 1 |
| 4 | Route grammar, modifier matching, and target specificity | 0 | 2 | 2 |
| 5 | DOM geometry, pointer tracking, shortcuts, and ingestion | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A distant release can dispatch a click without crossing the drag path

[pointerRecognizer.ts](packages/gestures/src/recognizer/pointerRecognizer.ts#L280) · Pass 1 · Medium · Source-traced

Only move checks the displacement from the press. If the release supplies the first sample beyond the drag threshold, the press is still buffered and release composes a click from it. With the secondary button it instead opens the context menu. A click-only tool can act on a press and release whose endpoints are farther apart than the recognizer's drag threshold.

### 2. Shadow-root controls can lose their native keyboard actions to page shortcuts

[keyOwner.ts](packages/gestures/src/ui/keyOwner.ts#L88) · Pass 2 · Medium · Source-traced

The helpers called by focusedControlOwnsKey inspect the retargeted event target, so a document listener outside a shadow root sees its host instead of the focused button, select, or range input. The routing keyboard dispatcher relies on this check before it handles a matching shortcut. As a result it can claim Space from a focused shadow button or an arrow from a shadow range input, suppressing its native action.

Source and tests were left untouched.
