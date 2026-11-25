# Review saturation for `apps.chart.src.part2`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 27 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Theme gesture cancellation against the document history | 1 | 1 | 0 |
| 2 | Stencil drop, insert and snap handoff | 0 | 1 | 1 |
| 3 | Theme application, plot retheming and style controls | 0 | 1 | 2 |
| 4 | Toolbar bindings, template choices and chart snapping | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Canceling a theme edit can erase a different chart edit

[useThemeEdit.ts](apps/chart/src/theme/useThemeEdit.ts#L79) · Pass 1 · Medium · Source-traced

Let a theme color preview write a history entry, then commit a separate chart edit before canceling the preview. Cancellation jumps the whole scene to the index from before the preview and drops redo. It undoes and discards the separate edit along with the preview because it records an index instead of tracking gesture-owned changes.

Source and tests were left untouched.
