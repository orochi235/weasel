## Graphviz reads only `\"` as an escape inside a quoted string, so the DOT writer produces strings Graphviz cannot parse, and the reader misreads `\\"`
- where: packages/diagram-formats/src/dot/lex.ts:72 (dotTokens, quotedPart)
- scenario: Take a page named `C:\` or a node id `ends\`. `dotId` and `quoteLabel` write it as `"C:\\"`. In Graphviz's lexer, `\"` is the only escape, so `\\"` reads as a literal backslash followed by an escaped quote. The string does not end at that quote and runs on to the next `"`, so Graphviz rejects the file or reads it wrongly. This package's own lexer reads `\\` as a pair (line 72) and accepts the file, which is why write.test.ts's "ids … holding backslashes" round trip passes. The same rule hurts on the read side. A Graphviz file whose string holds `\\"`, such as `label="a\\"b"` (which is `a\"b` to Graphviz), gets cut at that quote here. `nameOf` (parse.ts:54) also folds `\\` to `\` in ids, so the distinct Graphviz nodes `"a\\b"` and `"a\b"` merge into one node. Only `\"` should be special. A trailing backslash should be written so Graphviz reads it (for example, split with a line continuation) rather than as `\\"`.
- evidence: read (Graphviz's DOT grammar documentation: "the only escaped character is double-quote")
- severity: medium
- fix: packages/diagram-formats/src/dot/lex.ts, packages/diagram-formats/src/dot/parse.ts, packages/diagram-formats/src/dot/write.ts, packages/diagram-formats/src/dot/values.ts
- size: function
- cause: the lexer treats `\\` as an escape that Graphviz does not have
- confidence: likely

## A collapsed node exports every hidden row as visible text, and its collapsed state is dropped without a warning
- where: packages/diagram-formats/src/rowLines.ts:5 (rowLines), reached through packages/diagram-formats/src/graphWrite.ts:47 (nodeLines)
- scenario: Take a class-style node folded to its header. `readShape` (sceneReaders.ts:172-177) gives it `rows: [header, ...folded]` and `collapsed: true`. `rowLines` writes every row as a line and ignores `collapsed`. The DOT label therefore holds all the hidden fields, while `width`/`height` (write.ts:60-61) are the collapsed box's size. Read back, the node is open, and on a placed page its text overflows a header-sized box. Unlike marks, ports and slots, this loss gets no warning. It should write the header alone, or warn that the collapse was dropped.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/graphWrite.ts
- size: function
- cause: `collapsed` is never consulted when rows are flattened to lines
- confidence: likely

## Inverted and hollow DOT arrowheads are read as other markers without a warning, while unknown names do get one
- where: packages/diagram-formats/src/dot/values.ts:134 (ARROWS)
- scenario: `arrowhead=inv` maps to `'arrow'`, and `oinv`/`invempty` map to `'triangle-hollow'`, so a head Graphviz draws pointing back toward the line draws pointing forward. `odot` and `obox` (hollow) map to the filled `circle` and `square`. `marker()` (read.ts:243-248) warns "DOT arrowheads drawn as arrows" only for names missing from the table, so these silent changes never reach the import warnings.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/read.ts
- size: function
- cause: approximate table entries are treated as exact
- confidence: sure

## An empty `bb=""` makes the reader take `pos` as points rather than inches
- where: packages/diagram-formats/src/dot/positions.ts:17 (positions)
- scenario: Take `graph [bb=""]` with `a [pos="1,2"]`. `str(root.graph,'bb')` is `''`, which is not `undefined`, so `unit` is 1 and `pos` reads as points: the node lands at (1,2) instead of (72,144). Everywhere else this reader treats `""` as unset (`keyword`, `colorAttr`, `numberAttr`), and its own rule is "a graph without a `bb`" means inches.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/read.ts
- size: line
- cause: `''` is checked as present instead of unset
- confidence: sure

## An unknown `dir` value removes both arrowheads, where Graphviz keeps the graph's default
- where: packages/diagram-formats/src/dot/read.ts:252 (readEdge)
- scenario: In a digraph, take `a -> b [dir=Forward]` (Graphviz compares `dir` case-sensitively), or any misspelling. Graphviz leaves an unrecognized `dir` at its default, forward, and draws the arrow. Here `dir` is `'Forward'`, so neither the `forward`/`both` test nor `back`/`both` matches: `markerEnd` becomes `null` and the edge reads with no arrow and no warning.
- evidence: read
- severity: low
- size: line
- cause: unknown `dir` values are not mapped back to the default
- confidence: likely

## An edge to a subgraph opened again joins only the nodes named in that opening
- where: packages/diagram-formats/src/dot/read.ts:157 (DotReader.end)
- scenario: Take `subgraph s { a }  subgraph s { b } -> c`. Graphviz joins every node of subgraph `s` (`a` and `b`) to `c`. `end()` takes the set `walk` returns for this opening's statements only, so only `b -> c` is made.
- evidence: read
- severity: low
- size: function
- cause: a named subgraph's node set is not kept across openings
- confidence: likely

## `sortedPage` sorts with `localeCompare`, which ties distinct ids, so the comparison it exists for can fail spuriously
- where: packages/diagram-formats/src/testing/samePage.ts:5 (byId)
- scenario: The property tests draw ids from `oddText`, whose `ODD` set includes U+200B (zero-width space). Under ICU collation, `'a\u200b'.localeCompare('a') === 0`. Two such nodes or edges keep their input order, so a writer and a reader that list them in different orders compare as unequal even though the same items are on the page. Member lists are sorted by code unit (`.sort()`), so only the top-level lists are affected.
- evidence: read
- severity: low
- size: line
- cause: collation order used where a total code-unit order is needed
- confidence: likely

## Files read
packages/diagram-formats/src/colorCheck.ts
packages/diagram-formats/src/document.ts
packages/diagram-formats/src/dot/format.ts
packages/diagram-formats/src/dot/lex.ts
packages/diagram-formats/src/dot/parse.ts
packages/diagram-formats/src/dot/positions.ts
packages/diagram-formats/src/dot/read.ts
packages/diagram-formats/src/dot/values.ts
packages/diagram-formats/src/dot/write.ts
packages/diagram-formats/src/dot/x11.ts
packages/diagram-formats/src/exportPage.ts
packages/diagram-formats/src/formats.ts
packages/diagram-formats/src/fromScene.ts
packages/diagram-formats/src/graphPageMeta.ts
packages/diagram-formats/src/graphRead.ts
packages/diagram-formats/src/graphWrite.ts
packages/diagram-formats/src/index.ts
packages/diagram-formats/src/jsonFormat.ts
packages/diagram-formats/src/lineError.ts
packages/diagram-formats/src/markReaders.ts
packages/diagram-formats/src/pageKinds.ts
packages/diagram-formats/src/pageLayout.ts
packages/diagram-formats/src/pageRoots.ts
packages/diagram-formats/src/pageSvg.ts
packages/diagram-formats/src/pbt.fixture.ts
packages/diagram-formats/src/plotPages.ts
packages/diagram-formats/src/rowLines.ts
packages/diagram-formats/src/sceneReaders.ts
packages/diagram-formats/src/sequencePage.ts
packages/diagram-formats/src/shiftData.ts
packages/diagram-formats/src/templates/catalog.ts
packages/diagram-formats/src/templates/starters.ts
packages/diagram-formats/src/templates/templateScene.ts
packages/diagram-formats/src/testing/asGraph.ts
packages/diagram-formats/src/testing/authoredScene.ts
packages/diagram-formats/src/testing/docScene.ts
packages/diagram-formats/src/testing/pageScene.ts
packages/diagram-formats/src/testing/samePage.ts
packages/diagram-formats/src/toScene.ts

<!-- done: 7 findings, files read: 39 -->