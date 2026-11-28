# Review saturation for `storage`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. The tracked working tree was clean at the start of review. Scope is the 18 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Record closure, explicit flushing and retries | 1 | 1 | 0 |
| 2 | Structured clone comparison and remote reconciliation | 1 | 2 | 0 |
| 3 | IndexedDB commit and peer notification consistency | 1 | 3 | 0 |
| 4 | First-read recovery, synchronous adapters and default storage | 0 | 3 | 1 |
| 5 | JSON fidelity, URL hashes and persistence boundaries | 0 | 3 | 2 |
| 6 | File picker, page lifecycle and adapter contracts | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A closed record cache can still flush queued writes

[records.ts](packages/storage/src/records.ts#L134) · Pass 1 · Medium · Source-traced

The writable predicate omits closed, and the public flush delegates straight to the queue. After close returns false with a failed write still queued, a later explicit flush can send it, contrary to the close contract. The cache also continues reporting writable after closure.

### 2. Remote reconciliation cannot compare cyclic structured-clone records

[cloneEqual.ts](packages/storage/src/cloneEqual.ts#L34) · Pass 2 · Medium · Source-traced

The adapters support cyclic structured-clone values, but cloneEqual recursively compares objects and collections without recording visited pairs. Two separately cloned cyclic records overflow the stack during reconciliation. Because reconciliation calls the comparison after its read catch, it rejects without applying the value or retrying.

### 3. IndexedDB peer notifications can describe a different value from the committed record

[indexedDb.ts](packages/storage/src/indexedDb.ts#L168) · Pass 3 · Medium · Source-traced

The transaction clones its input at put time. After the asynchronous commit, the adapter broadcasts the original object. If it changed in between, peers receive the changed value while a fresh read returns the committed snapshot. A mutation that makes the object unclonable can also make set reject after the write has landed.

Source and tests were left untouched.
