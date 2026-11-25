Architecture service lines joined with spaces (A): fixed fec587ff6d (a shrunk test expecting the old joined text was updated in a9c7c5ce86)
Architecture empty service title read back as its id (A): fixed 5822225647
Block writer drops connector colors silently (A): fixed 7bd36cfc0b
C4 description shaped like `[x]` taken as technology (A): fixed 8db2be2687
Class reader throws on nested generics (A): fixed d361f8c9fd (the writer now also writes `Foo<List<int>>` back as `Foo~List~int~~`)
Gantt task named `accTitle`/`accDescr` reads as accessibility text (A): fixed be83a0c807 (a timeline period had the same bug and is fixed in the same commit)
Journey step named `accTitle`/`accDescr` reads as accessibility text (A): fixed 40c81a8cab (the step is dropped with a warning, following the 2026-11-11 ruling for `title`/`section` steps)
Gantt/gitGraph/journey writers drop a page name without warning (A): fixed 8678fee284
Gantt/journey readers drop the accessible title silently (A): fixed 1aca51d1e3 (C4's reader now goes through the same `readPageName` path, and the three wordings of the front-matter warning are now one)
Gantt task ids holding a comma or space break the line (A): fixed 841a92d739
Lean-left and inverted-trapezoid shapes read as their mirror images (A): fixed 3f79df6a71 (a warning, since `@weasel-js/diagram` has no mirrored outline; the `@{ shape: … }` names lean-l, out-in, trap-t and manual are covered too)
Flowchart lexer miscounts lines after multi-line `@{ … }` (A): fixed d6c0fad06e. Its second part, newline-separated pairs, is fixed in f7b325be2c.
Block `space` before a links line lands on a later block (B): fixed 1e6167f078
Block writer drops connector colors silently (B): duplicate of A "Block writer drops connector colors"
Architecture writer drops container colors silently (B): fixed d43d902623
Architecture empty service label becomes its id (B): duplicate of A "Architecture empty service title"
C4 writer ignores resolved edge colors (B): fixed 7572a2c9e5 for relationships, which now write their theme role's colors. Not a defect for elements: their role encodes the C4 kind (external is `muted`).
Class and ER writers rename ids their readers accept (B): fixed 2cc62d74fb
Class writer loses open vs filled arrow without warning (B): fixed bdfe6873f7
ER writer drops connectors to containers silently (B): fixed abcd019a11
Flowchart `v` direction lost (B): fixed 0559e20bce (an unknown direction now warns too)
Gantt/journey/gitGraph writers drop a page name (B): duplicate of A "The gantt, gitGraph and journey writers drop a page name"
`accTitle { … }` read as an accessible description (B): fixed d55e6efadd. This was a strict call: it now throws, naming the line, since Mermaid opens a block only for `accDescr`. It is recorded in `docs/unruled.md` under a new round-72 section.
`headerWord` and `frontMatter` decide front matter differently (B): fixed 41e4daf20d. A consumer sees no difference: the unclosed case was refused before and still is. The change is internal, so it has no changeset.

Extra: 5 changeset titles were over the 140-character limit and were split in e3acc9cea1. No extra defects were found.

Checks:
- `npm run checks:gate`: all 33 passed
- `npm run check:changesets`: OK, 567 changesets
- `npm run lint -w @weasel-js/diagram-formats`: not run, because the package has no `lint` script. Instead, `npx eslint` on every changed `.ts` file passed (exit 0).
- Every `packages/diagram-formats/src/mermaid/**/*.test.ts`, one file at a time with `--maxWorkers=1`: all pass, including the touched architecture, block, c4, class, er, gantt, journey, gitgraph, timeline.shrunk, flowchart lex/parse/read, common lines/header, and mermaid.shrunk files.
- Every other non-browser test file mentioning Mermaid: all pass.
- No browser test files were touched.
- The tree is clean.

tally: 24 of 24 fixed, 0 extra fixed