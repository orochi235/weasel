---
'@weasel-js/plot': patch
'@weasel-js/diagram-formats': patch
---

Fix chart scales and Mermaid readers on edge cases

- `spacedTicks` returns no ticks, rather than looping until the array overflows, where the step multiples are past counting (a domain like 1e17..1e17+100), as `ticks()` already did.
- A time scale spanning decades ticks on 1, 2 or 5 times a power of ten years, so a 40-year span asked for 5 ticks gets 4 rather than 41.
- A gantt date in years 0 to 99 reads as itself rather than as 1900 to 1999, and `%j` counts its day of the year from its own January.
- A Mermaid `accDescr { … }` block closed on the line it opens on no longer swallows the statements after it.
- A Mermaid flowchart reads an `accDescr { … }` block running over several lines instead of throwing.
- A Mermaid xychart or sequence diagram reads past a `%%{…}%%` directive running over several lines instead of throwing.
- A quoted front matter title reads the same in a Mermaid sequence diagram and xychart as in every other kind: escapes in double quotes read, `''` in single quotes as one quote.
- A Mermaid packet diagram writes a gap between fields as an unlabeled field, which Mermaid reads, instead of a field Mermaid rejects for not starting where the one before ends; an unlabeled field reads back as a gap.
