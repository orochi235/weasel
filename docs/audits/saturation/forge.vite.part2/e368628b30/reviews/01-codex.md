# Review saturation for `forge.vite.part2`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 26 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Watcher recovery when a served file disappears | 1 | 1 | 0 |
| 2 | Story index commits across overlapping watcher events | 1 | 2 | 0 |
| 3 | Virtual module generation, page serving, and config extraction | 0 | 2 | 1 |
| 4 | Native export and wrapper discovery, story globs, and title checks | 0 | 2 | 2 |
| 5 | Prop controls, generated type documentation, and watcher probe lifecycle | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Watcher recovery ignores a served file that has been deleted

[watchRecovery.ts](packages/forge/src/vite/watchRecovery.ts#L86) · Pass 1 · Medium · Source-traced

When the OS drops an unlink event, stat returns no modification time. missed treats that exactly like an untracked file and returns false, so both the quiet sweep and the request middleware leave the stale module in place. For an indexed story this also prevents Forge from receiving the unlink it needs to remove the story.

### 2. An older wrapper resolution can restore a story file after unlink

[storyIndex.ts](packages/forge/src/vite/storyIndex.ts#L105) · Pass 2 · Medium · Source-traced

settle checks membership before awaiting the resolver. A concurrent unlink can remove the file and its wrapper state while that lookup is in flight. The old lookup can then set the wrapper state and call readInto; if the file is still gone, the catch inserts it back as an empty entry. A later add or other edit can consequently operate on stale wrapper state, and the old lookup can also overwrite a newer wrapper decision for a file that still exists.

Source and tests were left untouched.
