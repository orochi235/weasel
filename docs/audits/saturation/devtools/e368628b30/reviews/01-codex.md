# Review saturation for `devtools`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 18 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Client-wide errors and outstanding request settlement | 1 | 1 | 0 |
| 2 | Handshake ordering under synchronous state observers | 1 | 2 | 0 |
| 3 | Trace and history follower cursor races | 0 | 2 | 1 |
| 4 | Panel root changes, query dependencies, and polling teardown | 0 | 2 | 2 |
| 5 | Lazy attachment lifetime, tabs, and picker wiring | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A connection-level error leaves issued requests pending

[client.ts](packages/devtools/src/client.ts#L135) · Pass 1 · Medium · Source-traced

Issue a request while connecting, then receive a connection-level refusal such as a protocol mismatch. The client moves to error and rejects later requests, but keeps the earlier request in pending without rejecting it. A caller waiting for that request stays blocked until the client is explicitly closed.

### 2. A connecting subscriber can send a request before the handshake

[client.ts](packages/devtools/src/client.ts#L170) · Pass 2 · Low · Source-traced

A state subscriber that calls request() upon seeing connecting sends immediately because open() publishes that state before sending yo. With the in-page transport the request goes out before its page session is installed and gets no reply. The subsequent handshake can complete successfully while the first request stays pending.

Source and tests were left untouched.
