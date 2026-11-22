A carriage return in sequence text was written raw and threw on reading back (A): fixed ae11a154c2. A note's text also broke at a line or paragraph separator; the same commit fixes that.

Sequence ids such as `titleé` or `linksé` were read back as statements, because `\b` only knows ASCII letters (A): fixed c9fe8aa49f

A kanban column sharing an id with a card was written under one id, and the reader threw (A): fixed 827be0cc2b. Two columns sharing an id threw the same way; the same commit fixes that.

A kanban card listed in two lanes was written twice, contradicting the writer's own warning (B): fixed 827be0cc2b, the same change as the finding above.

A mind map node with id `accTitle` or `accDescr` and a hexagon outline was read as an accDescr block (A): fixed ef51b60e3a

The sankey writer dropped a page name with no warning (A+B): fixed 2e09087720

The sequence writer silently dropped a box whose members only steps name (A+B): fixed a00e2acb7d

A kanban metadata value holding `]@{` split the card wrong, and the rest threw as metadata (A): fixed 5aa4ebd3df

The state writer dropped a pool's direct members and turned its nested containers into regions (B): fixed d0da3970f0. These are now written as a region of their own, with a warning. That was a strict call with no ruling behind it, recorded in `docs/unruled.md`.

An uncolored sequence region was written with a gray fill that read back as a color (B): fixed e2285360ab. It is now written as `rect transparent`. That was a strict call with no ruling behind it, recorded in `docs/unruled.md`.

Extra: a state with id `accTitle` or `accDescr` wrote its description as `accTitle : …`, which read back as the diagram's accessible title (sweep): fixed 5c9bdeb2cf. Mind map, state, and sequence now share one `ACC_WORDS` list.

Checks:
- `npx vitest run --maxWorkers=1` on each touched test file: sequence/write.test.ts pass (16), sankey/sankey.test.ts pass (10), mindmap/mindmap.test.ts pass (12), state/state.test.ts pass (27), kanban/kanban.test.ts pass (18).
- `npm run checks:gate`: pass, "all 32 passed".
- `npm run lint -w @weasel-js/diagram-formats`: not run, because the package has no `lint` script. `npx eslint` on every changed `.ts` file: pass (exit 0).
- The tree is clean.

tally: 10 of 12 fixed, 1 extra fixed