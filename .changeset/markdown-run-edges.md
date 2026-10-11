---
'@weasel-js/text': patch
---

Three edge cases in the markdown run helpers. `markdownToRuns` with a custom grammar whose shortest marker is longer than one character (`~~`) treated a lone `~` as that marker and swallowed the character after it; a delimiter run too short for any marker is now literal text. `runsToMarkdown` wrote an empty bold run as `****`, which reads back as "bold on" for everything after it; empty runs are now skipped. `layoutMarkdown` reported `width: -Infinity` for runs with no characters and now reports 0.
