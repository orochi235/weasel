---
'@weasel-js/diagram-formats': patch
---

Mermaid C4 and kanban text is written through the shared Mermaid escaper, as every other kind's is, so it reads back
as written: a C4 quote stays a quote rather than turning into an apostrophe, a kanban `]` stays a bracket rather
than a parenthesis, and text holding a character reference such as `#lt;` is not decoded on the way back in.
