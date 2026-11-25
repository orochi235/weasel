# Review saturation for `core.canvas.renderWorker`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 21 files listed for this area in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Request settlement, exceptions and timeout cleanup | 1 | 1 | 0 |
| 2 | Bitmap transfer, answer ordering and disposal races | 1 | 2 | 0 |
| 3 | Scene deltas, resets and mirrored input state | 0 | 2 | 1 |
| 4 | Frame acknowledgement, clock updates and animation operations | 0 | 2 | 2 |
| 5 | Layer runs, health changes, stack replacement and client lifetime | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

| ID | Defect | Where | First | Severity | Evidence |
|---|---|---|---:|---|---|
| W1 | A throwing settlement callback can leave an already removed request pending forever | [requests.ts](packages/core/src/canvas/renderWorker/requests.ts#L42) | 1 | Medium | Source-traced |
| W2 | An image copy started before disposal can still attempt a transfer afterward | [workerImages.ts](packages/core/src/canvas/renderWorker/workerImages.ts#L84) | 2 | Low | Source-traced |

- **W1.** Add a request whose optional settlement callback throws, then supply its answer. The request is removed and its timer canceled. The callback is invoked before the promise resolver, so the promise never settles and later drain cannot find it. A throwing callback also aborts a drain before it reaches later requests. Request cleanup and promise settlement should survive the observer's error.
- **W2.** Request an image that is already cached, then dispose the worker while `createImageBitmap` is copying it. The immediate cache-hit path returns a no-op stop callback, and the asynchronous handler still replies with the new bitmap even after the page has released and terminated that worker. That path does not explicitly close an unused copy or catch failure in the transfer callback. [Page reply](packages/core/src/canvas/renderWorker/startSceneRenderWorker.ts#L105)

Source and tests were left untouched.
