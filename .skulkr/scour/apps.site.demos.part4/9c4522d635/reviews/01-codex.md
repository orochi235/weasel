# Review saturation for `apps.site.demos.part4`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 48 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Plot sample initialization and rejected reads | 1 | 1 | 0 |
| 2 | PDF and raster export timing and resource setup | 0 | 1 | 1 |
| 3 | Routing gesture context and resize math | 0 | 1 | 2 |
| 4 | Preferences state, rig playback and shape lab wiring | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A plot sample load failure leaves a blank demo with no error state

[PlotKindsDemo.tsx](apps/site/demos/PlotKindsDemo.tsx#L28) · Pass 1 · Low · Source-traced

If the Mermaid reader rejects while opening a sample, the effect only handles fulfillment. The rejection is unhandled and the selected stage remains empty, with no message. A synchronous reader failure also escapes because the read runs before Promise.resolve receives its argument.

Source and tests were left untouched.
