# Review saturation for `react`

Snapshot `0269be874a5adbbc9f6a3bd2b580f6a1dd1dea4f`. The tracked working tree was clean at the start of review. Scope is the 31 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Frame cancellation identity and abandoned-render subscriptions | 2 | 2 | 0 |
| 2 | Visibility transitions, viewport observation and elapsed clock rebasing | 0 | 2 | 1 |
| 3 | DOM watcher cleanup, style roots, ref assignment and storage access | 0 | 2 | 2 |
| 4 | Media, kit settings and test instrumentation contracts | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A canceled update can consume its replacement frame

[scheduledFrame.ts](packages/react/src/scheduledFrame.ts#L29) · Pass 1 · P2 · Source-traced

Schedule a paint frame and two update loops on one clock. While the paint drains its update snapshot, have the first update cancel the second and request it again. The snapshot still invokes the canceled entry. Its early callback has no identity check and cancels the replacement handle held in rafRef before running. The replacement runs in the stale slot instead of remaining queued on its own frame.

### 2. An abandoned render can leave a permanent notifier subscription

[useNotified.ts](packages/react/src/useNotified.ts#L13) · Pass 1 · P3 · Source-traced

Render a component that calls useNotified on a long-lived source and then suspends before committing. countOf subscribes during render and discards the unsubscribe. React never mounts the managed subscription, so no cleanup runs for the counter. An event source that starts polling when its listener count becomes nonzero can therefore keep polling with no mounted users.

Source and tests were left untouched.
