ERD entity fields had name and type swapped against the ER reader/writer, so PK/FK were lost on export (A+B): fixed 671d314586

The UML interface's `«interface»` was exported as the class name, with the real name written as an attribute (A+B): fixed d1714af5bf

The UML abstract class marked abstractness only with italics, which the class writer drops (A+B): fixed 2e81361e12. It now has a `<<abstract>>` row and the method is written `+ draw()*`. The stencil grew to 124 tall for the extra row.

The mind-map subtopic's `stadium` has no Mermaid mind-map bracket (A+B): fixed da8a1cf643. The subtopic is now `rect`. `floating-note`'s `note` outline: not a defect, because a floating note is a separate root, which the mind-map writer drops whatever its outline.

The BPMN end event differed from a start event only by stroke width, so draw.io wrote it as a start event and read draw.io's own end event back as a start event (B): fixed fb747c04a0. It now has its own `endEvent` outline, a circle with a filled heavy ring. draw.io maps it to `outline=end` both ways, and Mermaid writes it as the nearest circle. `figureOver` now passes an outline's `solid` part through. This adds an outline name, so its changeset is `minor`.

`expectStencilsBuild` counted only label and field rows, though `stencilInsertOps` also makes nodes for header rows and their asides (B): fixed 1bbead5235

`expectStencilsBuild` left the `console.warn` spy in place when an assertion failed (A+B): fixed 1bbead5235

`expectStencilsBuild` measured every row unstyled (A+B): fixed 1bbead5235, without a failing test. The body grows to fit its rows as measured in their own style, so no stencil can lay out a row narrower than its styled text. Now the check at least measures what it says it does.

Extra defect found while fixing:
- The test helper `authoredScene` placed stencils in `DEFAULT_NODE_STYLE` instead of the theme's role style, as the real stencil tool does. Every authored mind map therefore warned "hold no colors" on export. Fixed in da8a1cf643, which also makes `mermaidRoundTrip` return the writer's warnings. It is test-only, so it has no changeset.
- 9da37c1549 is a cleanup of my own commits: it fixes the glyph type in the new fixture test and shortens five changeset titles that were over 140 characters.

Checks run:
- `npx vitest run --maxWorkers=1`, one file or directory at a time:
  - `packages/diagram/src/stencils/` (includes the new `stencils.fixture.test.ts`): pass, 36
  - `packages/diagram/src/outlines/seeded.test.ts`: pass, 1
  - `packages/diagram/src/ports.pbt.test.ts`: pass, 2
  - `packages/diagram-formats/src/authoredNotations.test.ts`: pass, 9
  - `packages/diagram-formats/src/diagramTypeNotation.test.ts`: pass, 5
  - `packages/diagram-formats/src/drawXml/write.test.ts`: pass, 24
  - `packages/diagram-formats/src/mermaid/flowchart/write.test.ts`: pass, 16
- `npm run checks:gate`: pass, "checks:gate: all 32 passed"
- `npm run lint -w @weasel-js/diagram` and `npm run lint -w @weasel-js/diagram-formats`: fail, `Missing script: "lint"`, because neither package has a lint script. I ran `npx eslint` on every changed file instead: pass. The gate's root `npm run lint` also passed.
- `npm run check:changesets`: pass, "OK — 2032 changeset(s)"
- No browser tests were touched, and the tree is clean.