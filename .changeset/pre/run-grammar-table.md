---
"@weasel-js/core": patch
---

Make the inline run grammar a parameter instead of a hardcoded branch.

`runsToMarkdown` and `markdownToRuns` each had the markdown subset spelled out
in their control flow — `***`/`**`/`*` and a two-character escape set — so
reading or writing any other spelling meant forking both. They now take a
`RunGrammar`: a table of markers pairing a repeated delimiter with the run
flags it toggles, defaulting to `MARKDOWN_RUN_GRAMMAR`, which is exactly
today's behavior. Escaping follows the grammar's own delimiters.

Nothing changes for a caller that passes no grammar. `underline` and
`strikethrough` still have no markdown spelling and are still dropped by
`runsToMarkdown` — a grammar that wants `~~struck~~` now adds one marker
rather than editing the parser.
