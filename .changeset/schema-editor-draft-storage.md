---
'@weasel-js/ui': patch
---

`PrefSchemaEditor` takes `draftStorage`: somewhere other than `localStorage` to keep the draft under `draftKey`, and what was last submitted beside it. It is the `getItem`, `setItem`, and `removeItem` of a `Storage` (exported as `DraftStorage`), so a host can back it with a file. It is read as the editor mounts, so it has to hold its contents by then; a `setItem` that throws is asked again with fewer undo steps, as a full `localStorage` is.
