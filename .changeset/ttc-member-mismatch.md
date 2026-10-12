---
'@weasel-js/font': patch
---

Fixes: an outline face asked for by a PostScript name its `.ttc` or `.dfont` does not hold was drawn from the file's first member, usually Regular, so bold text got lighter above the outline threshold than below it. `createOpenTypeParser(name)` now rejects on that mismatch, naming the face it was asked for and the ones the file holds, and the registry leaves the text on the SDF tier with its usual one-time warning. This is a behavior change, made on an agent's judgment: a local font whose reported name differs from its `name` table no longer gets outlines at all.

`sfntFromCollection` still falls back to the first member with `matched: false`, and now also returns `names`, every member's PostScript name.
