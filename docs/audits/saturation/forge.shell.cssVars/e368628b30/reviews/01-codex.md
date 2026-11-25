# Review saturation for `forge.shell.cssVars`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 15 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Asynchronous saves across trial focus and panel remounts | 1 | 1 | 0 |
| 2 | Scale edits overwritten by individual token edits | 1 | 2 | 0 |
| 3 | Axis routing, definition slots, and token pins | 0 | 2 | 1 |
| 4 | Token filtering, reveal behavior, and section navigation | 0 | 2 | 2 |
| 5 | History coalescing, frame synchronization, and persistence | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Saving after a panel remount can overwrite newer trial edits

[useThemeSave.ts](packages/forge/src/shell/cssVars/useThemeSave.ts#L104) · Pass 1 · Medium · Source-traced

A pending save calls history.current through the panel instance that started it. Switch trial focus while the request is out, return, and make another edit to the original trial before the response. CssVarsPanel keys the panel by trial ID, so the new instance sees current records while the unmounted instance's refs remain at its old state. Its completion uses that stale snapshot and calls history.reset through setters that still write the same trial records, which can overwrite the newer override and erase its undo history.

### 2. A scale can be saved after every generated step has been overwritten by hand

[themeScales.ts](packages/forge/src/shell/cssVars/themeScales.ts#L121) · Pass 2 · Medium · Source-traced

unsavedScales checks that every step has an override, then returns the scale even when none still matches what the edit generated. useThemeSave writes the underlying scale and its referenced seeds before applying the manual token edits. A discarded scale value can still change other tokens sharing a seed, or introduce an unnecessary rule change, even though the trial only displays the hand-edited steps.

Source and tests were left untouched.
