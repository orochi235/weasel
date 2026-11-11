---
"@weasel-js/svg": patch
---

`parseSvg` empties the document it parsed once it has read it. Under jsdom, which keeps every parsed document alive, each call held on to its whole tree, about 120 KB for a small drawing, so thousands of calls in one process ran out of memory.
