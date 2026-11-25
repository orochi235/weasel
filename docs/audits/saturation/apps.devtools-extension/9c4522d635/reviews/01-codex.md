# Review saturation for `apps.devtools-extension`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 28 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Badge retry timers across navigation | 1 | 1 | 0 |
| 2 | Panel port reconnect and synchronous listener reentry | 1 | 2 | 0 |
| 3 | Frame root announcements and cleanup on disconnect | 0 | 2 | 1 |
| 4 | Content bridge lifecycle and popup presence reporting | 0 | 2 | 2 |
| 5 | Manifest and package build entrypoints | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Delayed probes from an old page can repopulate the badge during navigation

[badge.ts](apps/devtools-extension/src/background/badge.ts#L28) · Pass 1 · Low · Source-traced

Finish loading a page and begin navigating again before its delayed probes fire. The loading handler invalidates probes already started but does not cancel the previous page's scheduled probes. One can start with a fresh ticket during navigation and write a badge for the outgoing page after the loading handler cleared it.

### 2. A synchronous retry can create two panel ports during disconnect recovery

[portTransport.ts](apps/devtools-extension/src/panel/portTransport.ts#L87) · Pass 2 · Low · Source-traced

Register a transport listener that retries immediately when a pending request fails. Disconnect the port. The disconnect handler clears port and reports errors before scheduling or opening its replacement. The retry can open a port during that callback, then the original disconnect handler opens another and overwrites the stored port.

Source and tests were left untouched.
