[r39-6] canvas barrel says it withholds the content-handler list that the main entry exposes (carried): not a defect (no longer applies). Commit 11f5c61976 rewrote the ingestion comment at `packages/core/src/barrel/canvas.ts:149`. The comment no longer calls anything withheld. It now says `contentHandlerRegistry` lists the handlers and that `runIngest`, `handlersFor`, and `couldClaim` come onto this entry from `editingSeams`, which is what `packages/core/src/index.ts:40` exports.

Extra defects: none.

Checks: none run. I made no commits and changed no files, so there was nothing for tests, `checks:gate`, or lint to check. The tree is clean apart from `.skulkr/`.

tally: 0 of 1 fixed, 0 extra fixed