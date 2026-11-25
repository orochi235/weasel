# Review saturation for `apps.site`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 45 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Release link navigation and native modifier behavior | 1 | 1 | 0 |
| 2 | Demo resize input parity and reset | 1 | 2 | 0 |
| 3 | Demo source loading and page error containment | 0 | 2 | 1 |
| 4 | Release filters, deferred entries and source rendering | 0 | 2 | 2 |
| 5 | Site theme, backend selection, panels and registry routing | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Modified clicks on the release history link navigate the current tab

[ReleaseHistory.tsx](apps/site/ReleaseHistory.tsx#L89) · Pass 1 · Low · Source-traced

Control-click or Command-click the Older Releases link. Its handler prevents native navigation for every click and pushes the destination into the current tab. The gesture that normally opens a new tab replaces the reader's current page.

### 2. The demo resize control cannot be reset from the keyboard

[DemoFrame.tsx](apps/site/DemoFrame.tsx#L152) · Pass 2 · Low · Source-traced

Tab to the corner resize control and resize with an arrow key. The named button accepts only arrows from the keyboard and resets only on double-click. Enter and Space do nothing, so a keyboard user cannot invoke the same reset.

Source and tests were left untouched.
