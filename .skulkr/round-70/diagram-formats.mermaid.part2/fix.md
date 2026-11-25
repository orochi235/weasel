Quadrant axis ends holding `-->` read back split (A): fixed 8456701945. The writer itself was never wrong, since it writes `>` as `#gt;`, so its own output already read back. The defect was in the reader: hand-written `x-axis "a-->b" --> c` split at the `-->` inside the quotes. The reader now skips a `-->` inside quotes.
Note over no participants written as `Note over : x`, which the reader rejects (A+B): fixed 7224e460ad. The note is now dropped with a warning.
State writer drops a pool's lane labels silently (A): fixed d681985cd3.
State writer drops a fork/join bar's text silently (A): fixed c0b23a9579.
Sequence `create` step for a participant missing from `participants` is dropped (A): fixed f99756884c. It is now written as `create participant <id>`.
Mind map bang read as a cloud without a warning (A): fixed 2a43920add. The diagram package has no outline like a bang, so the reader warns.
Mind map writer counts a self-loop as the node's parent, so a real root is dropped (B): fixed 3d8808ae0a.

Checks:
- quadrant/quadrant.test.ts: pass (14 passed)
- sequence/write.test.ts: pass (18 passed)
- sequence/read.test.ts, author.test.ts, sequence.pbt.test.ts, sequence.shrunk.test.ts: pass
- state/state.test.ts: pass (29 passed)
- mindmap/mindmap.test.ts: pass (14 passed)
- `npm run check:changesets`: pass (301 changesets)
- `npm run checks:gate`: pass, "all 33 passed" after fixing two test-file type errors in the first run
- `npm run lint -w @weasel-js/diagram-formats`: not run, because the package has no `lint` script; eslint on the changed directories: pass

tally: 7 of 7 fixed, 0 extra fixed