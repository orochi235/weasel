---
'@weasel-js/ui': patch
---

`PrefSchemaEditor` takes `draftKey`: a name to keep the edited schema under in the browser's `localStorage`. With it set, every edit is saved, and an editor opened later under the same name starts from those edits, still listed as changes from `original`. "Discard draft" goes back to the baseline and removes the saved copy; it undoes like any edit. Beside it the editor says when the draft was last saved.

Code a schema holds, such as a boolean's `encoding`, is not stored. It is taken back from the baseline, and a node that was moved or re-keyed still finds its own. A draft is one whole schema: a leaf added to the source after the draft was saved does not appear until the draft is discarded.

The draft keeps the twenty steps nearest it each way, so undo and redo still work after a reload. A browser short of storage keeps fewer, down to the schema alone.
