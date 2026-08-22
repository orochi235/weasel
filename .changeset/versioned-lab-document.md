---
'@weasel-js/labkit': patch
---

Persist a lab as one versioned document rather than four loose keys.

`lk:<storageKey>` now holds `{version, workspaces, saves, layout, mode}` and
hydration runs a migration chain over it. A lab saved under the previous four
keys is folded into the document on first load; the old keys are removed only
after the new document is read back and confirmed, so a storage write that
fails silently leaves the original data intact. A document written by a newer
labkit than the one reading it is left alone and that store stops persisting,
rather than being overwritten. A document that fails to parse or migrate is set
aside under `lk:<storageKey>:quarantine`.

`serializeWorkspaces` and `deserializeWorkspaces` now take and return records
rather than a JSON string. Both are internal to the state runtime.
