# Review saturation for `devtools.page`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 13 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Root replacement and active session subscriptions | 1 | 1 | 0 |
| 2 | Serializer handling of ordinary values with throwing accessors | 1 | 2 | 0 |
| 3 | Serializer traversal cost when output limits cut collections | 1 | 3 | 0 |
| 4 | Ring cursor rebasing and watcher subscription release | 0 | 3 | 1 |
| 5 | Inspection attachment, scene and history notices, and teardown | 0 | 3 | 2 |
| 6 | Message shape, handler dispatch, and registry snapshots | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Replacing a registered root leaves sessions subscribed to the old root

[notices.ts](packages/devtools/src/page/notices.ts#L52) · Pass 1 · Medium · Source-traced

Register root A, attach a panel, then register root B with the same ID. The hook routes requests to B and announces it, but notices.follow returns early because that ID already has a subscription. B does not generate its own change notices and A's recording and listener stay attached until the ID is unfollowed.

### 2. An array index getter can make an entire value unreadable

[serialize.ts](packages/devtools/src/page/serialize.ts#L177) · Pass 2 · Medium · Source-traced

Inspect node data containing an array with a getter at index zero that throws. The serializer guards getters on object properties, but slice reads array indexes directly and throws. The request fails instead of showing a placeholder for the failed field and preserving the rest of the node detail.

### 3. A capped Map or Set preview still copies the entire collection

[serialize.ts](packages/devtools/src/page/serialize.ts#L184) · Pass 3 · Low · Source-traced

With the default 100-item limit, inspect node data containing a large Map or Set. The preview spreads the entire collection before applying the limit, creating an array and, for a Map, entry pairs proportional to the collection size on each read. Large application state can stall DevTools despite the requested preview cap.

Source and tests were left untouched.
