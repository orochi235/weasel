# Review saturation for `labkit.part1`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 32 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Job cancellation, queued updaters, and launch lifetime | 1 | 1 | 0 |
| 2 | Lightbox focus and Escape ownership across documents | 1 | 2 | 0 |
| 3 | Modal stack restoration and expansion state | 0 | 2 | 1 |
| 4 | Palette input, drag feedback, and drop routing | 0 | 2 | 2 |
| 5 | Instrument serializers, undo capability, and overview painting | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Canceled job folds can still run from a queued updater

[useJob.ts](packages/labkit/src/job/useJob.ts#L64) · Pass 1 · medium · Source-traced

drive tests the run token before enqueuing a functional setState updater, but the updater itself never checks it. With a deferred setter, a run can enqueue an item, be canceled or superseded, and still fold that item into the state later. The begin updater has the same gap even though launching the run itself is guarded.

### 2. Lightbox keyboard handling is attached to the wrong document for a portalled frame

[useLightboxModal.ts](packages/labkit/src/lightbox/useLightboxModal.ts#L106) · Pass 2 · medium · Source-traced

The root may belong to a same-origin frame while the React code executes in the parent document. The host-document listener never hears Escape from the focused frame. Focus capture and restoration likewise read the global document, and the module-wide open order lets the most recently opened lightbox in either document affect which one may close.

Source and tests were left untouched.
