---
'@weasel-js/labkit': patch
---

Fixes: a trial's config was written through two `setConfig`s that disagreed. A change made in the settings panel, or by a chrome contribution, ran the instrument's `onConfigChange` and took no undo snapshot, so an instrument declaring `undo: { snapshotOn: ['config.change'] }` got no undo entry for it; the instrument's own `ctx.setConfig` snapshotted and never ran `onConfigChange`. Both are now one write: it snapshots on `config.change` and `config.change:<path>`, writes, and runs `onConfigChange` against the stored record.

Changes behavior, on an agent's judgment, in the two places the old paths differed. An instrument's own `ctx.setConfig` now runs its `onConfigChange`. And a run of writes to one path, each within 500 ms of the last, shares one undo entry, so a slider drag undoes in one step; this holds for `ctx.setConfig` too, which used to record an entry per write. `ctx.setConfig` also warns in development about a path its config does not hold, as the panel's did.
