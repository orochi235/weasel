C4 reader lists an element declared twice in two boundaries (A): fixed 1a69a26f65. A repeated alias now throws, naming the line, as architecture already does.
C4 `UpdateElementStyle` naming no element throws (A): fixed c353a56096. It is dropped with a warning, and so is an `UpdateRelStyle` naming nothing. `UpdateRelStyle` now styles only the first matching relationship, as Mermaid does. The writer warns that colors on a later relationship with the same ends were dropped.
Flowchart `linkStyle … interpolate <curve>` loses its styles (A): fixed 9a90a1cd5f. The `interpolate <curve>` words are stripped before the styles are read, with a warning that the curve was dropped.
Mermaid detect accepts any-case flowchart headers the reader rejects (A): fixed 1250a2feca.
Journey writer drops a step named exactly "title" or "section" (A): fixed 0b99c14d81. The journey property test's copy of the rule and the `docs/unruled.md` wording now match.
Graph writers drop end labels and edge colors without a warning (A): fixed 2e2b932e7d. The check is now shared helpers in `common/styles.ts`, and flowchart and block use them too.
Class writer writes a method with no parentheses as an attribute without a warning (A): fixed 2e56ef2773.
Block reader treats a pending `space` two ways (A+B): fixed 1a214a5aee.
C4 writer turns a typed deployment node into a boundary macro (A): fixed 0fa62d2147. The `Boundary(b, "x", "system")` case is not a defect: it comes back with the same label.
Architecture writer lets a service id be `accTitle`/`accDescr` (B): fixed d2da66af14.
Block writer lets a block id be `accTitle`/`accDescr` (B): fixed 1095c0f047.
ER writer lets an entity id be `accTitle`/`accDescr` (B): fixed 968e5fa440.
Nested class generic starting with a non-ASCII-word character round-trips wrong (B): fixed 6037bf67aa. The writer now quotes any generic whose tildes would not read back as written, including ones holding `[`, `{`, or `"`.
Architecture edge side silently dropped at a `{group}` end (B): fixed 3daf8752f3. It now warns. The side can't be kept because cluster layout drops ports at container ends, and the existing test already asserts that.
Class writer writes a member row `<<x>>` that reads back as an annotation (B): fixed c562ab0d4d. The row is dropped with a warning.
Block reader drops a `space` before a re-mentioned block on an items line (B): duplicate of the A block-space finding above, fixed 1a214a5aee.

Extra: the `arrowHead` doc comment in `common/styles.ts` was sitting above `dropPorts`, so it described the wrong function (sweep): fixed 2e2b932e7d.

Checks:
- Each touched test file run on its own with `--maxWorkers=1`: c4/c4 pass (24), flowchart/read pass (18), flowchart/parse pass (10), format pass (8), journey/journey pass (13), plots.pbt pass (13), architecture/architecture pass (19), block/block pass (22), er/er pass (14), class/class pass (23). Not touched but run because they cover the changed writers: notations.pbt and mermaid.shrunk pass (25 together), charts.pbt pass, flowchart/write pass (16).
- `npm run checks:gate`: "checks:gate: all 33 passed".
- `npm run check:changesets`: pass.
- `npm run lint -w @weasel-js/diagram-formats`: not run, because the package has no lint script. The root `npm run lint` inside the gate passed.
- Tree clean.

tally: 16 of 16 fixed, 1 extra fixed